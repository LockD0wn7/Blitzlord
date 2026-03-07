export enum RoomStatus {
  Waiting = "waiting",
  Playing = "playing",
  Finished = "finished",
}

export interface RoomPlayer {
  playerId: string;
  playerName: string;
  isReady: boolean;
  isOnline: boolean;
  seatIndex: number;
}

export interface RoomInfo {
  roomId: string;
  roomName: string;
  status: RoomStatus;
  playerCount: number;
  maxPlayers: 3;
  wildcard: boolean;
}

export interface RoomDetail {
  roomId: string;
  roomName: string;
  status: RoomStatus;
  players: RoomPlayer[];
  maxPlayers: 3;
  wildcard: boolean;
}
