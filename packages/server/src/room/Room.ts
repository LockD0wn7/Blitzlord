import { RoomStatus } from "@blitzlord/shared";
import type { RoomDetail, RoomInfo, RoomPlayer } from "@blitzlord/shared";

export interface ModeVote {
  wildcard: boolean;
  initiator: string;
  votes: Map<string, boolean>;
}

export class Room {
  readonly roomId: string;
  readonly roomName: string;
  private _status: RoomStatus = RoomStatus.Waiting;
  private _players: RoomPlayer[] = [];
  readonly maxPlayers: 3 = 3;
  private _wildcard: boolean;
  private _modeVote: ModeVote | null = null;

  constructor(roomId: string, roomName: string, wildcard: boolean = false) {
    this.roomId = roomId;
    this.roomName = roomName;
    this._wildcard = wildcard;
  }

  get wildcard(): boolean {
    return this._wildcard;
  }

  get modeVote(): ModeVote | null {
    return this._modeVote;
  }

  get status(): RoomStatus {
    return this._status;
  }

  get players(): readonly RoomPlayer[] {
    return [...this._players].sort((a, b) => a.seatIndex - b.seatIndex);
  }

  get playerCount(): number {
    return this._players.length;
  }

  get isFull(): boolean {
    return this._players.length >= this.maxPlayers;
  }

  /** 添加玩家到房间，返回 seatIndex 或 null（满员） */
  addPlayer(playerId: string, playerName: string): number | null {
    if (this.isFull) return null;
    if (this._players.some((p) => p.playerId === playerId)) return null;

    // 找一个空闲的座位
    const taken = new Set(this._players.map((p) => p.seatIndex));
    let seatIndex = 0;
    while (taken.has(seatIndex)) seatIndex++;

    this._players.push({
      playerId,
      playerName,
      isReady: false,
      isOnline: true,
      seatIndex,
    });
    return seatIndex;
  }

  /** 移除玩家 */
  removePlayer(playerId: string): boolean {
    const idx = this._players.findIndex((p) => p.playerId === playerId);
    if (idx === -1) return false;
    this._players.splice(idx, 1);
    return true;
  }

  /** 获取房间中的某个玩家 */
  getPlayer(playerId: string): RoomPlayer | undefined {
    return this._players.find((p) => p.playerId === playerId);
  }

  /** 设置玩家准备状态 */
  setReady(playerId: string, ready: boolean): boolean {
    const player = this.getPlayer(playerId);
    if (!player) return false;
    player.isReady = ready;
    return true;
  }

  /** 设置玩家在线状态 */
  setOnline(playerId: string, online: boolean): void {
    const player = this.getPlayer(playerId);
    if (player) player.isOnline = online;
  }

  /** 是否所有玩家都准备且满员 */
  get allReady(): boolean {
    return this.isFull && this._players.every((p) => p.isReady);
  }

  /** 开始游戏 */
  startPlaying(): void {
    this._status = RoomStatus.Playing;
  }

  /** 游戏结束 */
  finishGame(): void {
    this._status = RoomStatus.Finished;
  }

  /** 重置所有玩家准备状态 */
  resetReady(): void {
    for (const p of this._players) {
      p.isReady = false;
    }
  }

  /** 回到等待状态（游戏结束后再开） */
  backToWaiting(): void {
    this._status = RoomStatus.Waiting;
    this.resetReady();
  }

  /** 发起模式投票 */
  startModeVote(playerId: string, wildcard: boolean): { ok: boolean; error?: string } {
    if (this._status === RoomStatus.Playing) {
      return { ok: false, error: "游戏中不能发起投票" };
    }
    if (wildcard === this._wildcard) {
      return { ok: false, error: "不能投票切换到当前已有模式" };
    }
    if (this._modeVote !== null) {
      return { ok: false, error: "已有投票进行中" };
    }
    if (!this.getPlayer(playerId)) {
      return { ok: false, error: "玩家不在房间中" };
    }

    const votes = new Map<string, boolean>();
    votes.set(playerId, true); // 发起者自动投赞成票
    this._modeVote = { wildcard, initiator: playerId, votes };
    return { ok: true };
  }

  /** 投票 */
  castModeVote(playerId: string, agree: boolean): { ok: boolean; error?: string; result?: { passed: boolean; wildcard: boolean } } {
    if (this._modeVote === null) {
      return { ok: false, error: "没有进行中的投票" };
    }
    if (this._modeVote.votes.has(playerId)) {
      return { ok: false, error: "不能重复投票" };
    }
    if (!this.getPlayer(playerId)) {
      return { ok: false, error: "玩家不在房间中" };
    }

    this._modeVote.votes.set(playerId, agree);

    const totalPlayers = this._players.length;
    const agreeCount = [...this._modeVote.votes.values()].filter((v) => v).length;
    const disagreeCount = [...this._modeVote.votes.values()].filter((v) => !v).length;
    const majority = Math.ceil(totalPlayers * 2 / 3);

    // 检查是否达到多数或所有人都投完
    if (agreeCount >= majority) {
      const targetWildcard = this._modeVote.wildcard;
      this._wildcard = targetWildcard;
      this._modeVote = null;
      return { ok: true, result: { passed: true, wildcard: targetWildcard } };
    }
    if (disagreeCount >= majority) {
      const targetWildcard = this._modeVote.wildcard;
      this._modeVote = null;
      return { ok: true, result: { passed: false, wildcard: targetWildcard } };
    }
    if (this._modeVote.votes.size >= totalPlayers) {
      // 所有人都投了但没达到多数 — 不通过
      const targetWildcard = this._modeVote.wildcard;
      this._modeVote = null;
      return { ok: true, result: { passed: false, wildcard: targetWildcard } };
    }

    return { ok: true };
  }

  /** 转为房间列表项 */
  toRoomInfo(): RoomInfo {
    return {
      roomId: this.roomId,
      roomName: this.roomName,
      status: this._status,
      playerCount: this._players.length,
      maxPlayers: 3,
      wildcard: this._wildcard,
    };
  }

  /** 转为房间详情 */
  toRoomDetail(): RoomDetail {
    return {
      roomId: this.roomId,
      roomName: this.roomName,
      status: this._status,
      players: [...this.players],
      maxPlayers: 3,
      wildcard: this._wildcard,
    };
  }
}
