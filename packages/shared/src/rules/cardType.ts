import { CardType, Rank } from "../types/card.js";
import type { Card, CardPlay } from "../types/card.js";
import {
  SEQUENCE_RANKS,
  MIN_STRAIGHT_LENGTH,
  MIN_DOUBLE_STRAIGHT_LENGTH,
  MIN_TRIPLE_STRAIGHT_LENGTH,
} from "../constants/card.js";

/** 统计每个 rank 的出现次数 */
function countRanks(cards: Card[]): Map<Rank, number> {
  const counts = new Map<Rank, number>();
  for (const card of cards) {
    counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
  }
  return counts;
}

/** 按 count 分组 rank */
function groupByCount(counts: Map<Rank, number>) {
  const quads: Rank[] = [];
  const triples: Rank[] = [];
  const pairs: Rank[] = [];
  const singles: Rank[] = [];

  for (const [rank, count] of counts) {
    if (count === 4) quads.push(rank);
    else if (count === 3) triples.push(rank);
    else if (count === 2) pairs.push(rank);
    else singles.push(rank);
  }

  return { quads, triples, pairs, singles };
}

/** 检查一组 rank 是否构成连续序列（在 SEQUENCE_RANKS 范围内） */
function isConsecutive(ranks: Rank[], minLength: number): boolean {
  if (ranks.length < minLength) return false;
  const indices = ranks.map((r) => SEQUENCE_RANKS.indexOf(r)).filter((i) => i !== -1);
  if (indices.length !== ranks.length) return false; // 含 2 或王，不可能连续
  indices.sort((a, b) => a - b);
  for (let i = 1; i < indices.length; i++) {
    if (indices[i] !== indices[i - 1] + 1) return false;
  }
  return true;
}

/** 获取连续序列中的最小 rank */
function minRank(ranks: Rank[]): Rank {
  const indices = ranks.map((r) => SEQUENCE_RANKS.indexOf(r));
  const minIdx = Math.min(...indices);
  return SEQUENCE_RANKS[minIdx];
}

/**
 * 识别一组牌的牌型。
 * 返回 CardPlay 或 null（无效牌型）。
 *
 * 判定顺序：火箭 → 单张 → 对子 → 炸弹 → 四带二系列（优先于飞机）→ 三张系列 → 顺子 → 连对 → 飞机系列
 */
export function identifyCardType(cards: Card[]): CardPlay | null {
  if (cards.length === 0) return null;

  const counts = countRanks(cards);
  const { quads, triples, pairs, singles } = groupByCount(counts);

  // 火箭：大小王
  if (
    cards.length === 2 &&
    cards.some((c) => c.rank === Rank.BlackJoker) &&
    cards.some((c) => c.rank === Rank.RedJoker)
  ) {
    return { type: CardType.Rocket, cards, mainRank: Rank.RedJoker };
  }

  // 单张
  if (cards.length === 1) {
    return { type: CardType.Single, cards, mainRank: cards[0].rank };
  }

  // 对子
  if (cards.length === 2 && pairs.length === 1 && singles.length === 0) {
    return { type: CardType.Pair, cards, mainRank: pairs[0] };
  }

  // 炸弹：4 张相同
  if (cards.length === 4 && quads.length === 1) {
    return { type: CardType.Bomb, cards, mainRank: quads[0] };
  }

  // 四带二系列（优先于飞机）
  if (quads.length === 1) {
    const quadRank = quads[0];
    const remaining = cards.length - 4;

    // 四带二单：4 + 2 张单牌（两张单牌 rank 不能相同，否则就是 4+1对 的歧义，但斗地主中四带二单允许两张相同）
    // 实际上四带二单就是 6 张牌，4 张相同 + 任意 2 张
    if (remaining === 2 && triples.length === 0) {
      return { type: CardType.QuadWithTwo, cards, mainRank: quadRank };
    }

    // 四带两对：4 + 2 对
    if (remaining === 4 && pairs.length === 2 && triples.length === 0 && singles.length === 0) {
      return { type: CardType.QuadWithTwoPairs, cards, mainRank: quadRank };
    }
  }

  // 三张系列
  if (triples.length === 1 && quads.length === 0) {
    const tripleRank = triples[0];
    const remaining = cards.length - 3;

    // 三张
    if (remaining === 0) {
      return { type: CardType.Triple, cards, mainRank: tripleRank };
    }

    // 三带一
    if (remaining === 1) {
      return { type: CardType.TripleWithOne, cards, mainRank: tripleRank };
    }

    // 三带二（带一对）
    if (remaining === 2 && pairs.length === 1) {
      return { type: CardType.TripleWithPair, cards, mainRank: tripleRank };
    }
  }

  // 顺子：5+ 张连续单张
  if (
    cards.length >= MIN_STRAIGHT_LENGTH &&
    singles.length === cards.length &&
    quads.length === 0 &&
    triples.length === 0 &&
    pairs.length === 0 &&
    isConsecutive(singles, MIN_STRAIGHT_LENGTH)
  ) {
    return {
      type: CardType.Straight,
      cards,
      mainRank: minRank(singles),
      length: singles.length,
    };
  }

  // 连对：3+ 对连续对子
  if (
    pairs.length >= MIN_DOUBLE_STRAIGHT_LENGTH &&
    quads.length === 0 &&
    triples.length === 0 &&
    singles.length === 0 &&
    pairs.length * 2 === cards.length &&
    isConsecutive(pairs, MIN_DOUBLE_STRAIGHT_LENGTH)
  ) {
    return {
      type: CardType.DoubleStraight,
      cards,
      mainRank: minRank(pairs),
      length: pairs.length,
    };
  }

  // 飞机系列：2+ 组连续三张
  if (triples.length >= MIN_TRIPLE_STRAIGHT_LENGTH && quads.length === 0) {
    // 检查三张部分是否连续
    if (isConsecutive(triples, MIN_TRIPLE_STRAIGHT_LENGTH)) {
      const tripleCount = triples.length;
      const remaining = cards.length - tripleCount * 3;

      // 飞机不带
      if (remaining === 0) {
        return {
          type: CardType.TripleStraight,
          cards,
          mainRank: minRank(triples),
          length: tripleCount,
        };
      }

      // 飞机带单：带等量单张（翅膀可以是同 rank 不同花色）
      if (remaining === tripleCount) {
        return {
          type: CardType.TripleStraightWithOnes,
          cards,
          mainRank: minRank(triples),
          length: tripleCount,
        };
      }

      // 飞机带对：带等量对子
      if (remaining === tripleCount * 2 && pairs.length === tripleCount && singles.length === 0) {
        return {
          type: CardType.TripleStraightWithPairs,
          cards,
          mainRank: minRank(triples),
          length: tripleCount,
        };
      }
    }
  }

  return null;
}
