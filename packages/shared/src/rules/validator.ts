import type { Card, CardPlay, Rank } from "../types/card.js";
import { cardEquals } from "../utils/cardEquals.js";
import { identifyCardType } from "./cardType.js";
import { canBeat } from "./cardCompare.js";

export interface ValidateResult {
  valid: boolean;
  play?: CardPlay;
  error?: string;
}

/**
 * 验证出牌是否合法。
 *
 * 1. 检查所选牌是否都在手牌中
 * 2. 识别牌型
 * 3. 如有上家出牌，检查是否能打过
 */
export function validatePlay(
  cards: Card[],
  hand: Card[],
  previousPlay: CardPlay | null,
  wildcardRank?: Rank | null,
): ValidateResult {
  if (cards.length === 0) {
    return { valid: false, error: "没有选择任何牌" };
  }

  // 检查所选牌是否都在手牌中（使用 cardEquals）
  const handCopy = [...hand];
  for (const card of cards) {
    const idx = handCopy.findIndex((h) => cardEquals(h, card));
    if (idx === -1) {
      return { valid: false, error: "选择的牌不在手牌中" };
    }
    handCopy.splice(idx, 1);
  }

  // 识别牌型
  const play = identifyCardType(cards, wildcardRank);
  if (play === null) {
    return { valid: false, error: "无效的牌型" };
  }

  // 如果是自由出牌（无上家牌），任何有效牌型都可以
  if (previousPlay === null) {
    return { valid: true, play };
  }

  // 检查是否能打过上家
  if (!canBeat(play, previousPlay)) {
    return { valid: false, error: "打不过上家的牌" };
  }

  return { valid: true, play };
}
