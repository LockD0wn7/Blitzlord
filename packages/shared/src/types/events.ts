import type { Card, CardPlay } from "./card.js";
import type { GamePhase, GameSnapshot, PlayerRole, ScoreDetail } from "./game.js";
import type { RoomDetail, RoomInfo } from "./room.js";

/** 客户端 → 服务端事件 */
export interface ClientEvents {
  "room:create": (
    data: { roomName: string; playerName: string },
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

  "game:ready": () => void;

  "game:callLandlord": (
    data: { bid: 0 | 1 | 2 | 3 },
    callback: (res: { ok: boolean; error?: string }) => void,
  ) => void;

  "game:playCards": (
    data: { cards: Card[] },
    callback: (res: { ok: boolean; error?: string }) => void,
  ) => void;

  "game:pass": (
    callback: (res: { ok: boolean; error?: string }) => void,
  ) => void;

  "game:requestSync": () => void;
}

/** 服务端 → 客户端事件 */
export interface ServerEvents {
  "room:updated": (room: RoomDetail) => void;

  "room:listUpdated": (rooms: RoomInfo[]) => void;

  "game:started": (data: {
    hand: Card[];
    firstCaller: string;
    players: { playerId: string; playerName: string; seatIndex: number }[];
  }) => void;

  "game:callUpdate": (data: {
    playerId: string;
    bid: 0 | 1 | 2 | 3;
    nextCaller: string | null;
  }) => void;

  "game:landlordDecided": (data: {
    landlordId: string;
    bottomCards: Card[];
    baseBid: 1 | 2 | 3;
  }) => void;

  "game:turnChanged": (data: {
    currentTurn: string;
  }) => void;

  "game:cardsPlayed": (data: {
    playerId: string;
    play: CardPlay;
    remainingCards: number;
  }) => void;

  "game:passed": (data: {
    playerId: string;
    resetRound: boolean;
  }) => void;

  "game:ended": (data: {
    winnerId: string;
    winnerRole: PlayerRole;
    scores: Record<string, ScoreDetail>;
  }) => void;

  "game:syncState": (snapshot: GameSnapshot) => void;

  "player:disconnected": (data: { playerId: string }) => void;

  "player:reconnected": (data: { playerId: string }) => void;

  error: (data: { message: string }) => void;
}
