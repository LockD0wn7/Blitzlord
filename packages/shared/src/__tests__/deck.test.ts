import { describe, it, expect } from "vitest";
import { createDeck, shuffleDeck, dealCards } from "../utils/deck.js";
import { FULL_DECK, CARDS_PER_PLAYER, BOTTOM_CARD_COUNT } from "../constants/card.js";
import { Rank } from "../types/card.js";
import type { Card } from "../types/card.js";

describe("createDeck", () => {
  it("应创建 54 张牌", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(54);
  });

  it("应包含 2 张大小王", () => {
    const deck = createDeck();
    const jokers = deck.filter((c) => c.suit === null);
    expect(jokers).toHaveLength(2);
    expect(jokers.some((c) => c.rank === Rank.BlackJoker)).toBe(true);
    expect(jokers.some((c) => c.rank === Rank.RedJoker)).toBe(true);
  });

  it("应返回 FULL_DECK 的副本而非引用", () => {
    const deck = createDeck();
    expect(deck).not.toBe(FULL_DECK);
    expect(deck).toEqual([...FULL_DECK]);
  });
});

describe("shuffleDeck", () => {
  it("应返回相同数量的牌", () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck);
    expect(shuffled).toHaveLength(54);
  });

  it("应包含所有原始牌（不丢牌）", () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck);
    const toKey = (c: Card) => `${c.rank}:${c.suit}`;
    const originalKeys = [...deck].map(toKey).sort();
    const shuffledKeys = [...shuffled].map(toKey).sort();
    expect(shuffledKeys).toEqual(originalKeys);
  });

  it("不应修改原数组", () => {
    const deck = createDeck();
    const original = [...deck];
    shuffleDeck(deck);
    expect(deck).toEqual(original);
  });
});

describe("dealCards", () => {
  it("应发出 3 手 17 张 + 3 张底牌", () => {
    const deck = createDeck();
    const [h1, h2, h3, bottom] = dealCards(deck);
    expect(h1).toHaveLength(CARDS_PER_PLAYER);
    expect(h2).toHaveLength(CARDS_PER_PLAYER);
    expect(h3).toHaveLength(CARDS_PER_PLAYER);
    expect(bottom).toHaveLength(BOTTOM_CARD_COUNT);
  });

  it("总牌数应为 54", () => {
    const deck = createDeck();
    const [h1, h2, h3, bottom] = dealCards(deck);
    expect(h1.length + h2.length + h3.length + bottom.length).toBe(54);
  });

  it("四组牌之间不应有重复", () => {
    const deck = createDeck();
    const [h1, h2, h3, bottom] = dealCards(deck);
    const allCards = [...h1, ...h2, ...h3, ...bottom];
    const keys = allCards.map((c) => `${c.rank}:${c.suit}`);
    const unique = new Set(keys);
    expect(unique.size).toBe(54);
  });
});
