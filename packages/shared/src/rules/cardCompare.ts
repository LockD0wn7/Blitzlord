import { CardType } from "../types/card.js";
import type { CardPlay } from "../types/card.js";

/**
 * 判断 current 是否能打过 previous。
 *
 * 规则：
 * - 火箭 > 一切
 * - 炸弹 > 非炸弹非火箭；炸弹之间比 mainRank
 * - 同类型且 mainRank 更大（顺子/连对/飞机需长度相同）
 */
export function canBeat(current: CardPlay, previous: CardPlay): boolean {
  // 火箭打一切
  if (current.type === CardType.Rocket) return true;
  // 被火箭压的，只有火箭能打
  if (previous.type === CardType.Rocket) return false;

  // 炸弹打非炸弹
  if (current.type === CardType.Bomb && previous.type !== CardType.Bomb) return true;
  // 非炸弹打不过炸弹
  if (current.type !== CardType.Bomb && previous.type === CardType.Bomb) return false;

  // 类型必须相同
  if (current.type !== previous.type) return false;

  // 有长度要求的牌型（顺子/连对/飞机系列）需长度相同
  if (current.length !== undefined && previous.length !== undefined) {
    if (current.length !== previous.length) return false;
  }

  // 比较 mainRank
  return current.mainRank > previous.mainRank;
}
