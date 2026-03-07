import { create } from "zustand";
import type { RoomInfo, RoomDetail } from "@blitzlord/shared";

interface ModeVote {
  initiator: string;
  wildcard: boolean;
}

interface RoomState {
  rooms: RoomInfo[];
  currentRoom: RoomDetail | null;
  modeVote: ModeVote | null;
  setRooms: (rooms: RoomInfo[]) => void;
  setCurrentRoom: (room: RoomDetail | null) => void;
  setModeVote: (vote: ModeVote | null) => void;
  clearModeVote: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  rooms: [],
  currentRoom: null,
  modeVote: null,
  setRooms: (rooms) => set({ rooms }),
  setCurrentRoom: (currentRoom) => set({ currentRoom }),
  setModeVote: (modeVote) => set({ modeVote }),
  clearModeVote: () => set({ modeVote: null }),
}));
