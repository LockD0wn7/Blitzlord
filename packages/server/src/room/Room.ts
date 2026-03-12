import { RoomStatus } from "@blitzlord/shared";
import type { PlayerType, RoomDetail, RoomInfo, RoomPlayer } from "@blitzlord/shared";

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

export interface ConfigVoteResult {
  passed: boolean;
  selection: RoomGameSelection;
}

export type StartConfigVoteResponse =
  | { ok: true; status: "started" }
  | { ok: true; status: "resolved"; result: ConfigVoteResult }
  | { ok: false; error: string };

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
  private _pendingConfigVoteResult: ConfigVoteResult | null = null;

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

  addPlayer(playerId: string, playerName: string, playerType: PlayerType = "human"): number | null {
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
      playerType,
      isReady: playerType === "bot",
      isOnline: true,
      seatIndex,
    });

    return seatIndex;
  }

  removePlayer(playerId: string): boolean {
    const index = this._players.findIndex((player) => player.playerId === playerId);
    if (index === -1) return false;

    const [removedPlayer] = this._players.splice(index, 1);

    if (this._configVote) {
      this._configVote.votes.delete(playerId);
      if (removedPlayer.playerType === "human") {
        const resolution = this.settleConfigVoteIfResolved();
        if (resolution) {
          this._pendingConfigVoteResult = resolution;
        }
      }
    }

    return true;
  }

  getPlayer(playerId: string): RoomPlayer | undefined {
    return this._players.find((player) => player.playerId === playerId);
  }

  setReady(playerId: string, ready: boolean): boolean {
    const player = this.getPlayer(playerId);
    if (!player) return false;
    player.isReady = player.playerType === "bot" ? true : ready;
    return true;
  }

  setOnline(playerId: string, online: boolean): void {
    const player = this.getPlayer(playerId);
    if (player) {
      player.isOnline = online;
    }
  }

  get allReady(): boolean {
    return this.isFull && this._players.every((player) => player.playerType === "bot" || player.isReady);
  }

  startPlaying(): void {
    this._status = RoomStatus.Playing;
  }

  finishGame(): void {
    this._status = RoomStatus.Finished;
  }

  resetReady(): void {
    for (const player of this._players) {
      player.isReady = player.playerType === "bot";
    }
  }

  backToWaiting(): void {
    this._status = RoomStatus.Waiting;
    this.resetReady();
  }

  consumePendingConfigVoteResult(): ConfigVoteResult | null {
    if (!this._pendingConfigVoteResult) {
      return null;
    }

    const result: ConfigVoteResult = {
      passed: this._pendingConfigVoteResult.passed,
      selection: cloneSelection(this._pendingConfigVoteResult.selection),
    };
    this._pendingConfigVoteResult = null;
    return result;
  }

  private getHumanPlayerIds(): Set<string> {
    return new Set(
      this._players
        .filter((player) => player.playerType === "human")
        .map((player) => player.playerId),
    );
  }

  private resolveConfigVote(): ConfigVoteResult | null {
    if (!this._configVote) {
      return null;
    }

    const humanPlayerIds = this.getHumanPlayerIds();
    const totalHumanPlayers = humanPlayerIds.size;
    const majority = Math.max(1, Math.ceil((totalHumanPlayers * 2) / 3));
    const humanVotes = [...this._configVote.votes.entries()].filter(([playerId]) => humanPlayerIds.has(playerId));
    const agreeCount = humanVotes.filter(([, vote]) => vote).length;
    const disagreeCount = humanVotes.filter(([, vote]) => !vote).length;

    if (agreeCount >= majority) {
      return {
        passed: true,
        selection: cloneSelection(this._configVote.selection),
      };
    }

    if (totalHumanPlayers > 0 && (disagreeCount >= majority || humanVotes.length >= totalHumanPlayers)) {
      return {
        passed: false,
        selection: cloneSelection(this._configVote.selection),
      };
    }

    return null;
  }

  private settleConfigVoteIfResolved(): ConfigVoteResult | null {
    const resolution = this.resolveConfigVote();
    if (!resolution) {
      return null;
    }

    if (resolution.passed) {
      this._gameSelection = cloneSelection(resolution.selection);
    }
    this._configVote = null;

    return {
      passed: resolution.passed,
      selection: cloneSelection(resolution.selection),
    };
  }

  startConfigVote(playerId: string, selection: RoomGameSelection): StartConfigVoteResponse {
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

    const resolution = this.settleConfigVoteIfResolved();
    if (!resolution) {
      return { ok: true, status: "started" };
    }

    return {
      ok: true,
      status: "resolved",
      result: resolution,
    };
  }

  castConfigVote(
    playerId: string,
    agree: boolean,
  ): { ok: boolean; error?: string; result?: ConfigVoteResult } {
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

    const resolution = this.settleConfigVoteIfResolved();
    if (!resolution) {
      return { ok: true };
    }

    return {
      ok: true,
      result: resolution,
    };
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

