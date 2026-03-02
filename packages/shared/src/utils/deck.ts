import type { Card } from "../types/card.js";
import { FULL_DECK, CARDS_PER_PLAYER, BOTTOM_CARD_COUNT } from "../constants/card.js";

/** 创建一副新牌（54 张） */
export function createDeck(): Card[] {
  return FULL_DECK.map((card) => ({ ...card }));
}

/** Fisher-Yates 洗牌 */
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/** 发牌：返回 [玩家1手牌, 玩家2手牌, 玩家3手牌, 底牌] */
export function dealCards(deck: Card[]): [Card[], Card[], Card[], Card[]] {
  const hand1 = deck.slice(0, CARDS_PER_PLAYER);
  const hand2 = deck.slice(CARDS_PER_PLAYER, CARDS_PER_PLAYER * 2);
  const hand3 = deck.slice(CARDS_PER_PLAYER * 2, CARDS_PER_PLAYER * 3);
  const bottom = deck.slice(CARDS_PER_PLAYER * 3, CARDS_PER_PLAYER * 3 + BOTTOM_CARD_COUNT);
  return [hand1, hand2, hand3, bottom];
}
