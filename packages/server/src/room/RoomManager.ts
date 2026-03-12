import { randomUUID } from "crypto";
import { Room } from "./Room.js";
import type { RoomGameSelection } from "./Room.js";
import { RoomStatus } from "@blitzlord/shared";
import type { RoomInfo } from "@blitzlord/shared";

export class RoomManager {
  private rooms = new Map<string, Room>();

  createRoom(
    roomName: string,
    playerId: string,
    playerName: string,
    selection: RoomGameSelection,
  ): Room {
    let roomId: string;
    do {
      roomId = randomUUID().slice(0, 8);
    } while (this.rooms.has(roomId));

    const room = new Room(roomId, roomName, selection);
    room.addPlayer(playerId, playerName);
    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  listRooms(): RoomInfo[] {
    return Array.from(this.rooms.values()).map((room) => room.toRoomInfo());
  }

  joinRoom(
    roomId: string,
    playerId: string,
    playerName: string,
  ): { ok: true; room: Room; seatIndex: number } | { ok: false; error: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { ok: false, error: "Room does not exist." };
    if (room.status !== RoomStatus.Waiting) return { ok: false, error: "Room has already started." };

    const seatIndex = room.addPlayer(playerId, playerName);
    if (seatIndex === null) return { ok: false, error: "Room is full." };

    return { ok: true, room, seatIndex };
  }

  addBot(
    roomId: string,
    botId: string,
    botName: string,
  ): { ok: true; room: Room; seatIndex: number } | { ok: false; error: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { ok: false, error: "Room does not exist." };
    if (room.status !== RoomStatus.Waiting) return { ok: false, error: "Room has already started." };
    if (room.getPlayer(botId)) return { ok: false, error: "Player is already in the room." };

    const seatIndex = room.addPlayer(botId, botName, "bot");
    if (seatIndex === null) return { ok: false, error: "Room is full." };

    return { ok: true, room, seatIndex };
  }

  leaveRoom(roomId: string, playerId: string): Room | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;

    const removed = room.removePlayer(playerId);
    if (!removed) {
      return room;
    }

    const hasHumanPlayer = room.players.some((player) => player.playerType === "human");
    if (!hasHumanPlayer) {
      this.rooms.delete(roomId);
      return undefined;
    }

    return room;
  }

  findRoomByPlayer(playerId: string): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.getPlayer(playerId)) {
        return room;
      }
    }
    return undefined;
  }

  removeBot(roomId: string, playerId: string): { ok: true; room: Room } | { ok: false; error: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { ok: false, error: "Room does not exist." };
    if (room.status !== RoomStatus.Waiting) return { ok: false, error: "Room has already started." };

    const player = room.getPlayer(playerId);
    if (!player) return { ok: false, error: "Player is not in the room." };
    if (player.playerType !== "bot") return { ok: false, error: "Player is not a bot." };

    room.removePlayer(playerId);
    return { ok: true, room };
  }

  removeRoom(roomId: string): void {
    this.rooms.delete(roomId);
  }
}

