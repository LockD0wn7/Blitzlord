import { describe, it, expect } from "vitest";
import { cardEquals } from "../utils/cardEquals.js";
import { Suit, Rank } from "../types/card.js";
import type { Card } from "../types/card.js";

describe("cardEquals", () => {
  it("应判定相同牌相等", () => {
    const a: Card = { suit: Suit.Spade, rank: Rank.Ace };
    const b: Card = { suit: Suit.Spade, rank: Rank.Ace };
    expect(cardEquals(a, b)).toBe(true);
  });

  it("应判定不同 rank 的牌不等", () => {
    const a: Card = { suit: Suit.Spade, rank: Rank.Ace };
    const b: Card = { suit: Suit.Spade, rank: Rank.King };
    expect(cardEquals(a, b)).toBe(false);
  });

  it("应判定不同 suit 的牌不等", () => {
    const a: Card = { suit: Suit.Spade, rank: Rank.Ace };
    const b: Card = { suit: Suit.Heart, rank: Rank.Ace };
    expect(cardEquals(a, b)).toBe(false);
  });

  it("应正确比较大小王", () => {
    const blackJoker: Card = { suit: null, rank: Rank.BlackJoker };
    const redJoker: Card = { suit: null, rank: Rank.RedJoker };
    const anotherBlackJoker: Card = { suit: null, rank: Rank.BlackJoker };
    expect(cardEquals(blackJoker, anotherBlackJoker)).toBe(true);
    expect(cardEquals(blackJoker, redJoker)).toBe(false);
  });

  it("应判定普通牌和大王不等", () => {
    const card: Card = { suit: Suit.Spade, rank: Rank.Three };
    const joker: Card = { suit: null, rank: Rank.RedJoker };
    expect(cardEquals(card, joker)).toBe(false);
  });
});
