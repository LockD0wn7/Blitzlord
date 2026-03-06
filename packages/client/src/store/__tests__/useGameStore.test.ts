import { beforeEach, describe, expect, it } from "vitest";
import { GamePhase, Rank, Suit } from "@blitzlord/shared";
import { useGameStore } from "../useGameStore";

const aceStat = {
  rank: Rank.Ace,
  totalCopies: 4,
  playedCopies: 1,
  myCopies: 1,
  remainingOpponentCopies: 2,
};

describe("useGameStore tracker state", () => {
  beforeEach(() => {
    useGameStore.getState().resetGame();
  });

  it("syncs tracker data without overwriting local panel state", () => {
    const store = useGameStore.getState();

    store.toggleTrackerPanel();
    expect(useGameStore.getState().isTrackerOpen).toBe(true);

    store.syncState({
      roomId: "room-1",
      phase: GamePhase.Playing,
      myHand: [{ rank: Rank.Ace, suit: Suit.Spade }],
      myRole: null,
      currentTurn: "p1",
      lastPlay: null,
      consecutivePasses: 0,
      bottomCards: [],
      baseBid: 1,
      bombCount: 0,
      rocketUsed: false,
      players: [],
      callSequence: [],
      tracker: {
        history: [
          {
            sequence: 1,
            round: 1,
            playerId: "p2",
            action: "pass",
            cards: [],
          },
        ],
        remainingByRank: [
          {
            rank: Rank.Ace,
            totalCopies: 4,
            playedCopies: 1,
            myCopies: 1,
            remainingOpponentCopies: 2,
          },
        ],
      },
    });

    expect(useGameStore.getState().tracker.history).toHaveLength(1);
    expect(useGameStore.getState().tracker.remainingByRank).toHaveLength(1);
    expect(useGameStore.getState().isTrackerOpen).toBe(true);
  });

  it("appends played tracker entries and replaces remaining rank stats", () => {
    useGameStore.getState().appendTrackerPlay(
      {
        sequence: 1,
        round: 1,
        playerId: "p2",
        action: "play",
        cards: [{ rank: Rank.King, suit: Suit.Heart }],
      },
      [aceStat],
    );

    expect(useGameStore.getState().tracker.history).toEqual([
      {
        sequence: 1,
        round: 1,
        playerId: "p2",
        action: "play",
        cards: [{ rank: Rank.King, suit: Suit.Heart }],
      },
    ]);
    expect(useGameStore.getState().tracker.remainingByRank).toEqual([aceStat]);
  });

  it("appends pass tracker entries without changing remaining rank stats", () => {
    const store = useGameStore.getState();

    store.syncTracker({
      history: [],
      remainingByRank: [aceStat],
    });

    store.appendTrackerPass({
      sequence: 2,
      round: 1,
      playerId: "p3",
      action: "pass",
      cards: [],
    });

    expect(useGameStore.getState().tracker.history).toEqual([
      {
        sequence: 2,
        round: 1,
        playerId: "p3",
        action: "pass",
        cards: [],
      },
    ]);
    expect(useGameStore.getState().tracker.remainingByRank).toEqual([aceStat]);
  });
});
