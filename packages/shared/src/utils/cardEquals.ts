import type { Card } from "../types/card.js";

/** 判断两张牌是否相同（rank + suit 均相等） */
export function cardEquals(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}
