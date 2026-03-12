import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GamePhase, PlayerRole, Rank, Suit } from "@blitzlord/shared";
import { useDoudizhuGameStore } from "../../../games/doudizhu/store/useDoudizhuGameStore";

let prepareDoudizhuBoardEntry: () => void;

describe("GameBoard room entry", () => {
  beforeAll(async () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
        clear: () => {},
      },
    });

    ({ prepareDoudizhuBoardEntry } = await import("../GameBoard"));
  });

  beforeEach(() => {
    useDoudizhuGameStore.getState().resetGame();
  });

  it("clears stale match state before requesting the next room snapshot", () => {
    const store = useDoudizhuGameStore.getState();

    store.setPhase(GamePhase.Ended);
    store.setHand([{ rank: Rank.Ace, suit: Suit.Spade }]);
    store.setPlayers([
      {
        playerId: "p1",
        playerName: "Alice",
        role: PlayerRole.Landlord,
        cardCount: 0,
        isOnline: true,
        playerType: "human",
      },
    ]);
    store.setGameResult({
      winnerId: "p1",
      winnerRole: PlayerRole.Landlord,
      scores: {
        p1: {
          baseBid: 1,
          bombCount: 0,
          rocketUsed: false,
          isSpring: false,
          finalScore: 2,
        },
      },
    });
    store.setWildcardRank(Rank.Seven);

    prepareDoudizhuBoardEntry();

    expect(useDoudizhuGameStore.getState().phase).toBeNull();
    expect(useDoudizhuGameStore.getState().myHand).toEqual([]);
    expect(useDoudizhuGameStore.getState().players).toEqual([]);
    expect(useDoudizhuGameStore.getState().gameResult).toBeNull();
    expect(useDoudizhuGameStore.getState().wildcardRank).toBeNull();
  });
});
