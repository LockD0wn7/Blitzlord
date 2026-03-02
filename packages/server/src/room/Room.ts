import { RoomStatus } from "@blitzlord/shared";
import type { RoomDetail, RoomInfo, RoomPlayer } from "@blitzlord/shared";

export class Room {
  readonly roomId: string;
  readonly roomName: string;
  private _status: RoomStatus = RoomStatus.Waiting;
  private _players: RoomPlayer[] = [];
  readonly maxPlayers: 3 = 3;

  constructor(roomId: string, roomName: string) {
    this.roomId = roomId;
    this.roomName = roomName;
  }

  get status(): RoomStatus {
    return this._status;
  }

  get players(): readonly RoomPlayer[] {
    return this._players;
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

  /** 转为房间列表项 */
  toRoomInfo(): RoomInfo {
    return {
      roomId: this.roomId,
      roomName: this.roomName,
      status: this._status,
      playerCount: this._players.length,
      maxPlayers: 3,
    };
  }

  /** 转为房间详情 */
  toRoomDetail(): RoomDetail {
    return {
      roomId: this.roomId,
      roomName: this.roomName,
      status: this._status,
      players: [...this._players],
      maxPlayers: 3,
    };
  }
}
