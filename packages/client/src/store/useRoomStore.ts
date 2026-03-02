import { create } from "zustand";
import type { RoomInfo, RoomDetail } from "@blitzlord/shared";

interface RoomState {
  rooms: RoomInfo[];
  currentRoom: RoomDetail | null;
  setRooms: (rooms: RoomInfo[]) => void;
  setCurrentRoom: (room: RoomDetail | null) => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  rooms: [],
  currentRoom: null,
  setRooms: (rooms) => set({ rooms }),
  setCurrentRoom: (currentRoom) => set({ currentRoom }),
}));
