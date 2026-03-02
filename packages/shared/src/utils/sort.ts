import type { Card } from "../types/card.js";

/** 按 rank 降序排列手牌（大牌在前），rank 相同按 suit 排序 */
export function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    if (a.rank !== b.rank) return b.rank - a.rank;
    // suit 为 null（大小王）排在最前
    if (a.suit === null && b.suit !== null) return -1;
    if (a.suit !== null && b.suit === null) return 1;
    if (a.suit === null && b.suit === null) return 0;
    return a.suit!.localeCompare(b.suit!);
  });
}
