import { beforeEach, describe, expect, it } from "vitest";
import { GamePhase, Rank, Suit } from "@blitzlord/shared";
import type { DoudizhuSnapshot } from "@blitzlord/shared/games/doudizhu";
import { useDoudizhuGameStore } from "../useDoudizhuGameStore";

const aceStat = {
  rank: Rank.Ace,
  totalCopies: 4,
  playedCopies: 1,
  myCopies: 1,
  remainingOpponentCopies: 2,
};

describe("useDoudizhuGameStore tracker state", () => {
  beforeEach(() => {
    useDoudizhuGameStore.getState().resetGame();
  });

  it("syncs tracker data without overwriting local panel state", () => {
    const store = useDoudizhuGameStore.getState();

    store.toggleTrackerPanel();
    expect(useDoudizhuGameStore.getState().isTrackerOpen).toBe(true);

    const snapshot: DoudizhuSnapshot = {
      roomId: "room-1",
      gameId: "doudizhu",
      modeId: "classic",
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
      wildcardRank: Rank.Seven,
    };

    store.syncState(snapshot);

    expect(useDoudizhuGameStore.getState().tracker.history).toHaveLength(1);
    expect(useDoudizhuGameStore.getState().tracker.remainingByRank).toHaveLength(1);
    expect(useDoudizhuGameStore.getState().isTrackerOpen).toBe(true);
    expect(useDoudizhuGameStore.getState().wildcardRank).toBe(Rank.Seven);
  });

  it("appends played tracker entries and replaces remaining rank stats", () => {
    useDoudizhuGameStore.getState().appendTrackerPlay(
      {
        sequence: 1,
        round: 1,
        playerId: "p2",
        action: "play",
        cards: [{ rank: Rank.King, suit: Suit.Heart }],
      },
      [aceStat],
    );

    expect(useDoudizhuGameStore.getState().tracker.history).toEqual([
      {
        sequence: 1,
        round: 1,
        playerId: "p2",
        action: "play",
        cards: [{ rank: Rank.King, suit: Suit.Heart }],
      },
    ]);
    expect(useDoudizhuGameStore.getState().tracker.remainingByRank).toEqual([aceStat]);
  });

  it("appends pass tracker entries without changing remaining rank stats", () => {
    const store = useDoudizhuGameStore.getState();

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

    expect(useDoudizhuGameStore.getState().tracker.history).toEqual([
      {
        sequence: 2,
        round: 1,
        playerId: "p3",
        action: "pass",
        cards: [],
      },
    ]);
    expect(useDoudizhuGameStore.getState().tracker.remainingByRank).toEqual([aceStat]);
  });

  it("applies hint selection and stores hint cursor state", () => {
    const store = useDoudizhuGameStore.getState();

    store.applyHintSelection(
      [{ rank: Rank.King, suit: Suit.Spade }],
      "ctx-1",
      2,
    );

    expect(useDoudizhuGameStore.getState().selectedCards).toEqual([
      { rank: Rank.King, suit: Suit.Spade },
    ]);
    expect(useDoudizhuGameStore.getState().hintContextKey).toBe("ctx-1");
    expect(useDoudizhuGameStore.getState().hintCursor).toBe(2);
  });

  it("resets hint cycle when turn changes or hand changes", () => {
    const store = useDoudizhuGameStore.getState();

    store.applyHintSelection(
      [{ rank: Rank.King, suit: Suit.Spade }],
      "ctx-1",
      2,
    );
    store.setCurrentTurn("p2");

    expect(useDoudizhuGameStore.getState().hintContextKey).toBeNull();
    expect(useDoudizhuGameStore.getState().hintCursor).toBe(0);

    store.applyHintSelection(
      [{ rank: Rank.Queen, suit: Suit.Heart }],
      "ctx-2",
      1,
    );
    store.setHand([{ rank: Rank.Ace, suit: Suit.Spade }]);

    expect(useDoudizhuGameStore.getState().hintContextKey).toBeNull();
    expect(useDoudizhuGameStore.getState().hintCursor).toBe(0);
  });
});
