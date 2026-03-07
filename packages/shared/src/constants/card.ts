import { Rank, Suit } from "../types/card.js";
import type { Card } from "../types/card.js";

export const PLAYER_COUNT = 3;
export const CARDS_PER_PLAYER = 17;
export const BOTTOM_CARD_COUNT = 3;
export const MAX_REDEAL_COUNT = 3;
export const DISCONNECT_TIMEOUT_MS = 60_000;

export const RANK_NAMES: Record<Rank, string> = {
  [Rank.Three]: "3",
  [Rank.Four]: "4",
  [Rank.Five]: "5",
  [Rank.Six]: "6",
  [Rank.Seven]: "7",
  [Rank.Eight]: "8",
  [Rank.Nine]: "9",
  [Rank.Ten]: "10",
  [Rank.Jack]: "J",
  [Rank.Queen]: "Q",
  [Rank.King]: "K",
  [Rank.Ace]: "A",
  [Rank.Two]: "2",
  [Rank.BlackJoker]: "小王",
  [Rank.RedJoker]: "大王",
};

export const SUIT_SYMBOLS: Record<Suit, string> = {
  [Suit.Spade]: "♠",
  [Suit.Heart]: "♥",
  [Suit.Diamond]: "♦",
  [Suit.Club]: "♣",
};

/** 一副完整的 54 张扑克牌 */
export const FULL_DECK: readonly Card[] = (() => {
  const cards: Card[] = [];
  const suits = [Suit.Spade, Suit.Heart, Suit.Diamond, Suit.Club];
  const ranks = [
    Rank.Three, Rank.Four, Rank.Five, Rank.Six, Rank.Seven,
    Rank.Eight, Rank.Nine, Rank.Ten, Rank.Jack, Rank.Queen,
    Rank.King, Rank.Ace, Rank.Two,
  ];
  for (const suit of suits) {
    for (const rank of ranks) {
      cards.push(Object.freeze({ suit, rank }));
    }
  }
  cards.push(Object.freeze({ suit: null, rank: Rank.BlackJoker }));
  cards.push(Object.freeze({ suit: null, rank: Rank.RedJoker }));
  return Object.freeze(cards);
})();

/** 顺子/连对/飞机中可用的 rank 范围（3~A，不含 2 和王） */
export const SEQUENCE_RANKS: readonly Rank[] = Object.freeze([
  Rank.Three, Rank.Four, Rank.Five, Rank.Six, Rank.Seven,
  Rank.Eight, Rank.Nine, Rank.Ten, Rank.Jack, Rank.Queen,
  Rank.King, Rank.Ace,
]);

/** 顺子最少张数 */
export const MIN_STRAIGHT_LENGTH = 5;

/** 连对最少对数 */
export const MIN_DOUBLE_STRAIGHT_LENGTH = 3;

/** 飞机最少组数 */
export const MIN_TRIPLE_STRAIGHT_LENGTH = 2;

/** 赖子模式中可被选为赖子的 rank 范围（3~2，不含王） */
export const WILDCARD_SEQUENCE_RANKS: readonly Rank[] = [
  Rank.Three, Rank.Four, Rank.Five, Rank.Six, Rank.Seven,
  Rank.Eight, Rank.Nine, Rank.Ten, Rank.Jack, Rank.Queen,
  Rank.King, Rank.Ace, Rank.Two,
] as const;
