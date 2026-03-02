import { describe, it, expect } from "vitest";
import { sortCards } from "../utils/sort.js";
import { Suit, Rank } from "../types/card.js";
import type { Card } from "../types/card.js";

describe("sortCards", () => {
  it("应按 rank 降序排列", () => {
    const cards: Card[] = [
      { suit: Suit.Spade, rank: Rank.Three },
      { suit: Suit.Heart, rank: Rank.Ace },
      { suit: Suit.Club, rank: Rank.Seven },
    ];
    const sorted = sortCards(cards);
    expect(sorted[0].rank).toBe(Rank.Ace);
    expect(sorted[1].rank).toBe(Rank.Seven);
    expect(sorted[2].rank).toBe(Rank.Three);
  });

  it("大小王应排在最前", () => {
    const cards: Card[] = [
      { suit: Suit.Spade, rank: Rank.Two },
      { suit: null, rank: Rank.BlackJoker },
      { suit: null, rank: Rank.RedJoker },
      { suit: Suit.Heart, rank: Rank.Ace },
    ];
    const sorted = sortCards(cards);
    expect(sorted[0].rank).toBe(Rank.RedJoker);
    expect(sorted[1].rank).toBe(Rank.BlackJoker);
    expect(sorted[2].rank).toBe(Rank.Two);
    expect(sorted[3].rank).toBe(Rank.Ace);
  });

  it("不应修改原数组", () => {
    const cards: Card[] = [
      { suit: Suit.Spade, rank: Rank.Three },
      { suit: Suit.Heart, rank: Rank.Ace },
    ];
    const original = [...cards];
    sortCards(cards);
    expect(cards).toEqual(original);
  });

  it("应处理空数组", () => {
    expect(sortCards([])).toEqual([]);
  });
});
