import type { Card } from "./card.js";
import type { GameSnapshot, PlayerRole, ScoreDetail } from "./game.js";
import type { RoomDetail, RoomInfo } from "./room.js";

export type MatchActionData =
  | { type: "callBid"; bid: 0 | 1 | 2 | 3 }
  | { type: "playCards"; cards: Card[] }
  | { type: "pass" };

/** 客户端 → 服务端事件 */
export interface ClientEvents {
  "room:create": (
    data: {
      roomName: string;
      playerName: string;
      gameId: string;
      modeId: string;
      config?: Record<string, unknown>;
    },
    callback: (res: { ok: boolean; roomId?: string; error?: string }) => void,
  ) => void;

  "room:join": (
    data: { roomId: string; playerName: string },
    callback: (res: { ok: boolean; error?: string }) => void,
  ) => void;

  "room:leave": () => void;

  "room:list": (
    callback: (rooms: RoomInfo[]) => void,
  ) => void;

  "room:requestSync": (
    callback: (res: { ok: boolean; room?: RoomDetail; error?: string }) => void,
  ) => void;

  "match:ready": () => void;

  "match:action": (
    data: MatchActionData,
    callback: (res: { ok: boolean; error?: string }) => void,
  ) => void;

  "match:requestSync": () => void;

  "room:voteConfigChange": (
    data: { gameId?: string; modeId?: string; configPatch?: Record<string, unknown> },
    cb: (res: { ok: boolean; error?: string }) => void,
  ) => void;

  "room:voteConfigChangeVote": (
    data: { agree: boolean },
    cb: (res: { ok: boolean; error?: string }) => void,
  ) => void;
}

/** 服务端 → 客户端事件 */
export interface ServerEvents {
  "room:updated": (room: RoomDetail) => void;

  "room:listUpdated": (rooms: RoomInfo[]) => void;

  "match:started": () => void;

  "match:ended": (data: {
    winnerId: string;
    winnerRole: PlayerRole;
    scores: Record<string, ScoreDetail>;
  }) => void;

  "match:syncState": (snapshot: GameSnapshot) => void;

  "player:disconnected": (data: { playerId: string }) => void;

  "player:reconnected": (data: { playerId: string }) => void;

  "room:voteConfigChangeStarted": (data: {
    initiator: string;
    gameId?: string;
    modeId?: string;
    configPatch?: Record<string, unknown>;
  }) => void;

  "room:voteConfigChangeResult": (data: {
    passed: boolean;
    gameId?: string;
    modeId?: string;
    configPatch?: Record<string, unknown>;
  }) => void;

  error: (data: { message: string }) => void;
}
