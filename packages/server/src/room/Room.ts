import { RoomStatus } from "@blitzlord/shared";
import type { RoomDetail, RoomInfo, RoomPlayer } from "@blitzlord/shared";

export interface RoomGameSelection {
  gameId: string;
  gameName: string;
  modeId: string;
  modeName: string;
  config: Record<string, unknown>;
}

export interface ConfigVote {
  selection: RoomGameSelection;
  initiator: string;
  votes: Map<string, boolean>;
}

function cloneConfig(config: Record<string, unknown>): Record<string, unknown> {
  return { ...config };
}

function cloneSelection(selection: RoomGameSelection): RoomGameSelection {
  return {
    gameId: selection.gameId,
    gameName: selection.gameName,
    modeId: selection.modeId,
    modeName: selection.modeName,
    config: cloneConfig(selection.config),
  };
}

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, normalizeValue(nested)]),
    );
  }
  return value;
}

function selectionSignature(selection: RoomGameSelection): string {
  return JSON.stringify({
    gameId: selection.gameId,
    gameName: selection.gameName,
    modeId: selection.modeId,
    modeName: selection.modeName,
    config: normalizeValue(selection.config),
  });
}

export function normalizeRoomGameSelection(selection: RoomGameSelection): RoomGameSelection {
  return {
    gameId: selection.gameId,
    gameName: selection.gameName,
    modeId: selection.modeId,
    modeName: selection.modeName,
    config: cloneConfig(selection.config),
  };
}

export class Room {
  readonly roomId: string;
  readonly roomName: string;
  readonly maxPlayers: 3 = 3;

  private _status: RoomStatus = RoomStatus.Waiting;
  private _players: RoomPlayer[] = [];
  private _gameSelection: RoomGameSelection;
  private _configVote: ConfigVote | null = null;

  constructor(roomId: string, roomName: string, selection: RoomGameSelection) {
    this.roomId = roomId;
    this.roomName = roomName;
    this._gameSelection = normalizeRoomGameSelection(selection);
  }

  get gameSelection(): RoomGameSelection {
    return cloneSelection(this._gameSelection);
  }

  get configVote(): ConfigVote | null {
    if (!this._configVote) {
      return null;
    }

    return {
      selection: cloneSelection(this._configVote.selection),
      initiator: this._configVote.initiator,
      votes: new Map(this._configVote.votes),
    };
  }

  get status(): RoomStatus {
    return this._status;
  }

  get players(): readonly RoomPlayer[] {
    return [...this._players].sort((left, right) => left.seatIndex - right.seatIndex);
  }

  get playerCount(): number {
    return this._players.length;
  }

  get isFull(): boolean {
    return this._players.length >= this.maxPlayers;
  }

  addPlayer(playerId: string, playerName: string): number | null {
    if (this.isFull) return null;
    if (this._players.some((player) => player.playerId === playerId)) return null;

    const takenSeats = new Set(this._players.map((player) => player.seatIndex));
    let seatIndex = 0;
    while (takenSeats.has(seatIndex)) {
      seatIndex += 1;
    }

    this._players.push({
      playerId,
      playerName,
      isReady: false,
      isOnline: true,
      seatIndex,
    });

    return seatIndex;
  }

  removePlayer(playerId: string): boolean {
    const index = this._players.findIndex((player) => player.playerId === playerId);
    if (index === -1) return false;
    this._players.splice(index, 1);
    return true;
  }

  getPlayer(playerId: string): RoomPlayer | undefined {
    return this._players.find((player) => player.playerId === playerId);
  }

  setReady(playerId: string, ready: boolean): boolean {
    const player = this.getPlayer(playerId);
    if (!player) return false;
    player.isReady = ready;
    return true;
  }

  setOnline(playerId: string, online: boolean): void {
    const player = this.getPlayer(playerId);
    if (player) {
      player.isOnline = online;
    }
  }

  get allReady(): boolean {
    return this.isFull && this._players.every((player) => player.isReady);
  }

  startPlaying(): void {
    this._status = RoomStatus.Playing;
  }

  finishGame(): void {
    this._status = RoomStatus.Finished;
  }

  resetReady(): void {
    for (const player of this._players) {
      player.isReady = false;
    }
  }

  backToWaiting(): void {
    this._status = RoomStatus.Waiting;
    this.resetReady();
  }

  startConfigVote(playerId: string, selection: RoomGameSelection): { ok: boolean; error?: string } {
    if (this._status === RoomStatus.Playing) {
      return { ok: false, error: "Cannot change room config while a match is in progress." };
    }
    if (!this.getPlayer(playerId)) {
      return { ok: false, error: "Player is not in the room." };
    }
    if (this._configVote) {
      return { ok: false, error: "Another config vote is already active." };
    }

    const nextSelection = normalizeRoomGameSelection(selection);
    if (selectionSignature(nextSelection) === selectionSignature(this._gameSelection)) {
      return { ok: false, error: "The requested config is already active." };
    }

    const votes = new Map<string, boolean>();
    votes.set(playerId, true);
    this._configVote = {
      selection: nextSelection,
      initiator: playerId,
      votes,
    };

    return { ok: true };
  }

  castConfigVote(
    playerId: string,
    agree: boolean,
  ): { ok: boolean; error?: string; result?: { passed: boolean; selection: RoomGameSelection } } {
    if (!this._configVote) {
      return { ok: false, error: "There is no active config vote." };
    }
    if (!this.getPlayer(playerId)) {
      return { ok: false, error: "Player is not in the room." };
    }
    if (this._configVote.votes.has(playerId)) {
      return { ok: false, error: "Player has already voted." };
    }

    this._configVote.votes.set(playerId, agree);

    const totalPlayers = this._players.length;
    const agreeCount = [...this._configVote.votes.values()].filter((vote) => vote).length;
    const disagreeCount = [...this._configVote.votes.values()].filter((vote) => !vote).length;
    const majority = Math.ceil((totalPlayers * 2) / 3);
    const targetSelection = cloneSelection(this._configVote.selection);

    if (agreeCount >= majority) {
      this._gameSelection = targetSelection;
      this._configVote = null;
      return {
        ok: true,
        result: {
          passed: true,
          selection: cloneSelection(targetSelection),
        },
      };
    }

    if (disagreeCount >= majority || this._configVote.votes.size >= totalPlayers) {
      this._configVote = null;
      return {
        ok: true,
        result: {
          passed: false,
          selection: targetSelection,
        },
      };
    }

    return { ok: true };
  }

  toRoomInfo(): RoomInfo {
    return {
      roomId: this.roomId,
      roomName: this.roomName,
      status: this._status,
      playerCount: this._players.length,
      maxPlayers: 3,
      gameId: this._gameSelection.gameId,
      gameName: this._gameSelection.gameName,
      modeId: this._gameSelection.modeId,
      modeName: this._gameSelection.modeName,
      configSummary: cloneConfig(this._gameSelection.config),
    };
  }

  toRoomDetail(): RoomDetail {
    return {
      roomId: this.roomId,
      roomName: this.roomName,
      status: this._status,
      players: [...this.players],
      maxPlayers: 3,
      gameId: this._gameSelection.gameId,
      gameName: this._gameSelection.gameName,
      modeId: this._gameSelection.modeId,
      modeName: this._gameSelection.modeName,
      configSummary: cloneConfig(this._gameSelection.config),
    };
  }
}
