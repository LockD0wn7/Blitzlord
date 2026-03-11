import { describe, expect, it } from "vitest";
import { GamePhase, Rank, RoomStatus } from "../index.js";
import type { GameSnapshot, RoomInfo } from "../index.js";
import type {
  DoudizhuModeConfig,
  DoudizhuSnapshot,
} from "../games/doudizhu/index.js";
import { isDoudizhuSnapshot } from "../games/doudizhu/index.js";

describe("doudizhu platform type boundaries", () => {
  it("uses gameId + modeId on platform room types", () => {
    const room: RoomInfo = {
      roomId: "room-1",
      roomName: "房间一",
      status: RoomStatus.Waiting,
      playerCount: 1,
      maxPlayers: 3,
      gameId: "doudizhu",
      gameName: "斗地主",
      modeId: "classic",
      modeName: "经典",
    };

    expect(room.gameId).toBe("doudizhu");
    expect(room.modeId).toBe("classic");
  });

  it("keeps platform snapshots free of wildcardRank", () => {
    const snapshot: GameSnapshot = {
      roomId: "room-1",
      gameId: "doudizhu",
      modeId: "classic",
      phase: GamePhase.Calling,
      myHand: [],
      myRole: null,
      currentTurn: null,
      lastPlay: null,
      consecutivePasses: 0,
      bottomCards: [],
      baseBid: 1,
      bombCount: 0,
      rocketUsed: false,
      players: [],
      callSequence: [],
      tracker: {
        history: [],
        remainingByRank: [],
      },
    };

    expect(snapshot.gameId).toBe("doudizhu");
    expect("wildcardRank" in snapshot).toBe(false);
  });

  it("moves doudizhu-specific mode config and snapshot into the game namespace", () => {
    const config: DoudizhuModeConfig = {
      wildcard: true,
    };

    const snapshot: DoudizhuSnapshot = {
      roomId: "room-1",
      gameId: "doudizhu",
      modeId: "wildcard",
      phase: GamePhase.Calling,
      myHand: [],
      myRole: null,
      currentTurn: null,
      lastPlay: null,
      consecutivePasses: 0,
      bottomCards: [],
      baseBid: 1,
      bombCount: 0,
      rocketUsed: false,
      players: [],
      callSequence: [],
      tracker: {
        history: [],
        remainingByRank: [],
      },
      wildcardRank: Rank.Seven,
    };

    expect(config.wildcard).toBe(true);
    expect(snapshot.wildcardRank).toBe(Rank.Seven);
  });

  it("narrows platform snapshots with a doudizhu-specific type guard", () => {
    const wildcardSnapshot: GameSnapshot = {
      roomId: "room-2",
      gameId: "doudizhu",
      modeId: "wildcard",
      phase: GamePhase.Playing,
      myHand: [],
      myRole: null,
      currentTurn: "player-1",
      lastPlay: null,
      consecutivePasses: 0,
      bottomCards: [],
      baseBid: 3,
      bombCount: 0,
      rocketUsed: false,
      players: [],
      callSequence: [],
      tracker: {
        history: [],
        remainingByRank: [],
      },
      wildcardRank: Rank.Ace,
    } as DoudizhuSnapshot;

    const classicSnapshot: GameSnapshot = {
      roomId: "room-3",
      gameId: "doudizhu",
      modeId: "classic",
      phase: GamePhase.Playing,
      myHand: [],
      myRole: null,
      currentTurn: "player-1",
      lastPlay: null,
      consecutivePasses: 0,
      bottomCards: [],
      baseBid: 1,
      bombCount: 0,
      rocketUsed: false,
      players: [],
      callSequence: [],
      tracker: {
        history: [],
        remainingByRank: [],
      },
    };

    expect(isDoudizhuSnapshot(wildcardSnapshot)).toBe(true);
    expect(isDoudizhuSnapshot(classicSnapshot)).toBe(false);
  });
});
