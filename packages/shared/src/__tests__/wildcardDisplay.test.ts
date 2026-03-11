import { describe, expect, it } from "vitest";
import { getDisplayCardsForPlay } from "../games/doudizhu/index.js";
import { CardType, Rank, Suit, type CardPlay } from "../types/card.js";

describe("getDisplayCardsForPlay", () => {
  it("shows transformed ranks for wildcard pairs", () => {
    const play: CardPlay = {
      type: CardType.Pair,
      mainRank: Rank.Ace,
      cards: [
        { rank: Rank.Ace, suit: Suit.Spade },
        { rank: Rank.Seven, suit: Suit.Heart },
      ],
    };

    expect(getDisplayCardsForPlay(play, Rank.Seven)).toEqual([
      { rank: Rank.Ace, suit: Suit.Spade },
      { rank: Rank.Ace, suit: Suit.Heart, isWildcard: true },
    ]);
  });

  it("shows transformed ranks for wildcard straights", () => {
    const play: CardPlay = {
      type: CardType.Straight,
      mainRank: Rank.Three,
      length: 5,
      cards: [
        { rank: Rank.Three, suit: Suit.Spade },
        { rank: Rank.Seven, suit: Suit.Heart },
        { rank: Rank.Five, suit: Suit.Club },
        { rank: Rank.Six, suit: Suit.Diamond },
        { rank: Rank.Seven, suit: Suit.Spade },
      ],
    };

    const result = getDisplayCardsForPlay(play, Rank.Seven);

    expect(result.map((card) => card.rank)).toEqual([
      Rank.Three,
      Rank.Four,
      Rank.Five,
      Rank.Six,
      Rank.Seven,
    ]);
    expect(result.filter((card) => card.isWildcard)).toHaveLength(2);
  });
});
