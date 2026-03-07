import { randomUUID } from "crypto";
import { Room } from "./Room.js";
import { RoomStatus } from "@blitzlord/shared";
import type { RoomInfo } from "@blitzlord/shared";

export class RoomManager {
  private rooms = new Map<string, Room>();

  /** 创建房间并将创建者加入 */
  createRoom(roomName: string, playerId: string, playerName: string, wildcard: boolean = false): Room {
    let roomId: string;
    do {
      roomId = randomUUID().slice(0, 8);
    } while (this.rooms.has(roomId));
    const room = new Room(roomId, roomName, wildcard);
    room.addPlayer(playerId, playerName);
    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  /** 获取所有房间的列表信息 */
  listRooms(): RoomInfo[] {
    return Array.from(this.rooms.values()).map((r) => r.toRoomInfo());
  }

  /** 将玩家加入指定房间 */
  joinRoom(
    roomId: string,
    playerId: string,
    playerName: string,
  ): { ok: true; room: Room; seatIndex: number } | { ok: false; error: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { ok: false, error: "房间不存在" };
    if (room.status !== RoomStatus.Waiting) return { ok: false, error: "游戏已开始，无法加入" };

    const seatIndex = room.addPlayer(playerId, playerName);
    if (seatIndex === null) return { ok: false, error: "房间已满" };

    return { ok: true, room, seatIndex };
  }

  /** 将玩家从其所在房间移除，返回被移除的房间（如果有） */
  leaveRoom(roomId: string, playerId: string): Room | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;

    room.removePlayer(playerId);

    // 房间空了就销毁
    if (room.playerCount === 0) {
      this.rooms.delete(roomId);
    }
    return room;
  }

  /** 通过 playerId 查找该玩家所在的房间 */
  findRoomByPlayer(playerId: string): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.getPlayer(playerId)) return room;
    }
    return undefined;
  }

  /** 删除房间 */
  removeRoom(roomId: string): void {
    this.rooms.delete(roomId);
  }
}
