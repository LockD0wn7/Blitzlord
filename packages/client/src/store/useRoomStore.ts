import { create } from "zustand";
import type { RoomDetail, RoomInfo } from "@blitzlord/shared";

interface ConfigVote {
  initiator: string;
  gameId?: string;
  modeId?: string;
  configPatch?: Record<string, unknown>;
}

interface RoomState {
  rooms: RoomInfo[];
  currentRoom: RoomDetail | null;
  configVote: ConfigVote | null;
  setRooms: (rooms: RoomInfo[]) => void;
  setCurrentRoom: (room: RoomDetail | null) => void;
  setConfigVote: (vote: ConfigVote | null) => void;
  clearConfigVote: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  rooms: [],
  currentRoom: null,
  configVote: null,
  setRooms: (rooms) => set({ rooms }),
  setCurrentRoom: (currentRoom) => set({ currentRoom }),
  setConfigVote: (configVote) => set({ configVote }),
  clearConfigVote: () => set({ configVote: null }),
}));
