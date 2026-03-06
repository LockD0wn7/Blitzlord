import { describe, expect, it } from "vitest";
import {
  GamePhase,
  Rank,
  Suit,
  type Card,
  type CardPlay,
  type GameSnapshot,
} from "@blitzlord/shared";
import {
  buildTrackerPassEntry,
  buildTrackerPlayUpdate,
  buildTrackerStateForGameStart,
  buildTrackerStateForLandlordDecision,
} from "../trackerState";

function card(rank: Rank, suit: Suit | null): Card {
  return { rank, suit };
}

function snapshot(history: GameSnapshot["tracker"]["history"] = []): GameSnapshot["tracker"] {
  return {
    history,
    remainingByRank: [],
  };
}

function play(cards: Card[]): CardPlay {
  return {
    type: "single",
    cards,
    mainRank: cards[0].rank,
  } as CardPlay;
}

describe("trackerState helpers", () => {
  it("rebuilds my tracker hand when landlord receives bottom cards", () => {
    const result = buildTrackerStateForLandlordDecision({
      token: "me",
      landlordId: "me",
      myHand: [card(Rank.Ace, Suit.Spade)],
      bottomCards: [card(Rank.Two, Suit.Heart)],
      history: [],
    });

    expect(result.nextHand).toEqual([
      card(Rank.Two, Suit.Heart),
      card(Rank.Ace, Suit.Spade),
    ]);
    expect(
      result.tracker.remainingByRank.find((entry) => entry.rank === Rank.Two)
        ?.myCopies,
    ).toBe(1);
  });

  it("starts a new round for the first play after control resets", () => {
    const result = buildTrackerPlayUpdate({
      token: "me",
      playerId: "me",
      myHand: [card(Rank.Ace, Suit.Spade)],
      tracker: snapshot([
        {
          sequence: 1,
          round: 1,
          playerId: "me",
          action: "play",
          cards: [card(Rank.King, Suit.Spade)],
        },
        {
          sequence: 2,
          round: 1,
          playerId: "p2",
          action: "pass",
          cards: [],
        },
        {
          sequence: 3,
          round: 1,
          playerId: "p3",
          action: "pass",
          cards: [],
        },
      ]),
      lastPlay: null,
      play: play([card(Rank.Ace, Suit.Spade)]),
    });

    expect(result.entry).toMatchObject({
      sequence: 4,
      round: 2,
      playerId: "me",
      action: "play",
    });
    expect(result.nextHand).toEqual([]);
  });

  it("keeps remaining rank stats unchanged for pass entries", () => {
    const aceStat = {
      rank: Rank.Ace,
      totalCopies: 4,
      playedCopies: 1,
      myCopies: 1,
      remainingOpponentCopies: 2,
    };

    const result = buildTrackerPassEntry({
      tracker: {
        history: [],
        remainingByRank: [aceStat],
      },
      playerId: "p2",
    });

    expect(result.entry).toMatchObject({
      sequence: 1,
      round: 1,
      playerId: "p2",
      action: "pass",
    });
    expect(result.remainingByRank).toEqual([aceStat]);
  });

  it("builds an empty tracker snapshot for a fresh hand", () => {
    const tracker = buildTrackerStateForGameStart([card(Rank.BlackJoker, null)]);

    expect(tracker.history).toEqual([]);
    expect(
      tracker.remainingByRank.find(
        (entry) => entry.rank === Rank.BlackJoker,
      )?.myCopies,
    ).toBe(1);
  });
});
