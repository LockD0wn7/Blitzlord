import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  CardTrackerSnapshot as RootCardTrackerSnapshot,
  TrackerHistoryEntry as RootTrackerHistoryEntry,
  TrackerRankStat as RootTrackerRankStat,
} from "../index.js";
import { Rank, Suit } from "../types/card.js";
import type { Card } from "../types/card.js";
import type {
  CardTrackerSnapshot as TypesCardTrackerSnapshot,
  TrackerHistoryEntry,
  TrackerHistoryEntry as TypesTrackerHistoryEntry,
  TrackerRankStat as TypesTrackerRankStat,
} from "../types/index.js";
import { buildCardTrackerSnapshot } from "../utils/cardTracker.js";

function card(rank: Rank, suit: Suit | null): Card {
  return { rank, suit };
}

describe("buildCardTrackerSnapshot", () => {
  it("re-exports tracker types from both barrels", () => {
    expectTypeOf<RootCardTrackerSnapshot>().toMatchTypeOf<TypesCardTrackerSnapshot>();
    expectTypeOf<RootTrackerHistoryEntry>().toMatchTypeOf<TypesTrackerHistoryEntry>();
    expectTypeOf<RootTrackerRankStat>().toMatchTypeOf<TypesTrackerRankStat>();
  });

  it("preserves history data and returns rank stats in tracker order", () => {
    const history: TrackerHistoryEntry[] = [
      {
        sequence: 1,
        round: 1,
        playerId: "p2",
        action: "play",
        cards: [card(Rank.Ace, Suit.Spade)],
      },
    ];

    const snapshot = buildCardTrackerSnapshot({
      myHand: [card(Rank.Two, Suit.Heart)],
      history,
    });

    expect(snapshot.history).toEqual(history);
    expect(snapshot.remainingByRank.map((entry) => entry.rank)).toEqual([
      Rank.RedJoker,
      Rank.BlackJoker,
      Rank.Two,
      Rank.Ace,
      Rank.King,
      Rank.Queen,
      Rank.Jack,
      Rank.Ten,
      Rank.Nine,
      Rank.Eight,
      Rank.Seven,
      Rank.Six,
      Rank.Five,
      Rank.Four,
      Rank.Three,
    ]);
  });

  it("copies history entries so mutating the snapshot does not affect the input", () => {
    const history: TrackerHistoryEntry[] = [
      {
        sequence: 1,
        round: 1,
        playerId: "p2",
        action: "play",
        cards: [card(Rank.Ace, Suit.Spade)],
      },
    ];

    const snapshot = buildCardTrackerSnapshot({
      myHand: [],
      history,
    });

    expect(snapshot.history).not.toBe(history);
    expect(snapshot.history[0]).not.toBe(history[0]);
    expect(snapshot.history[0].cards).not.toBe(history[0].cards);

    snapshot.history[0].cards.push(card(Rank.King, Suit.Heart));

    expect(history[0].cards).toEqual([card(Rank.Ace, Suit.Spade)]);
  });

  it("counts normal ranks from total, played, and my hand", () => {
    const snapshot = buildCardTrackerSnapshot({
      myHand: [
        card(Rank.Ace, Suit.Heart),
        card(Rank.Ace, Suit.Club),
      ],
      history: [
        {
          sequence: 1,
          round: 1,
          playerId: "p2",
          action: "play",
          cards: [card(Rank.Ace, Suit.Spade)],
        },
      ],
    });

    expect(
      snapshot.remainingByRank.find((entry) => entry.rank === Rank.Ace),
    ).toEqual({
      rank: Rank.Ace,
      totalCopies: 4,
      playedCopies: 1,
      myCopies: 2,
      remainingOpponentCopies: 1,
    });
  });

  it("tracks jokers with a total of one copy each", () => {
    const snapshot = buildCardTrackerSnapshot({
      myHand: [card(Rank.BlackJoker, null)],
      history: [
        {
          sequence: 1,
          round: 1,
          playerId: "p2",
          action: "play",
          cards: [card(Rank.RedJoker, null)],
        },
      ],
    });

    expect(
      snapshot.remainingByRank.find((entry) => entry.rank === Rank.BlackJoker),
    ).toEqual({
      rank: Rank.BlackJoker,
      totalCopies: 1,
      playedCopies: 0,
      myCopies: 1,
      remainingOpponentCopies: 0,
    });

    expect(
      snapshot.remainingByRank.find((entry) => entry.rank === Rank.RedJoker),
    ).toEqual({
      rank: Rank.RedJoker,
      totalCopies: 1,
      playedCopies: 1,
      myCopies: 0,
      remainingOpponentCopies: 0,
    });
  });

  it("does not count pass entries as played cards", () => {
    const snapshot = buildCardTrackerSnapshot({
      myHand: [],
      history: [
        {
          sequence: 1,
          round: 1,
          playerId: "p2",
          action: "pass",
          cards: [],
        },
      ],
    });

    expect(
      snapshot.remainingByRank.find((entry) => entry.rank === Rank.Three),
    ).toEqual({
      rank: Rank.Three,
      totalCopies: 4,
      playedCopies: 0,
      myCopies: 0,
      remainingOpponentCopies: 4,
    });
  });

  it("clamps invalid negative remaining counts to zero", () => {
    const snapshot = buildCardTrackerSnapshot({
      myHand: [
        card(Rank.Ace, Suit.Spade),
        card(Rank.Ace, Suit.Heart),
        card(Rank.Ace, Suit.Diamond),
        card(Rank.Ace, Suit.Club),
      ],
      history: [
        {
          sequence: 1,
          round: 1,
          playerId: "p2",
          action: "play",
          cards: [card(Rank.Ace, Suit.Spade)],
        },
      ],
    });

    expect(
      snapshot.remainingByRank.find((entry) => entry.rank === Rank.Ace)
        ?.remainingOpponentCopies,
    ).toBe(0);
  });
});
