import { create } from "zustand";

interface SocketState {
  connected: boolean;
  token: string;
  playerName: string;
  setConnected: (v: boolean) => void;
  setPlayerName: (name: string) => void;
}

export const useSocketStore = create<SocketState>((set) => ({
  connected: false,
  token: localStorage.getItem("playerId") || "",
  playerName: localStorage.getItem("playerName") || "",
  setConnected: (connected) => set({ connected }),
  setPlayerName: (playerName) => {
    localStorage.setItem("playerName", playerName);
    set({ playerName });
  },
}));
