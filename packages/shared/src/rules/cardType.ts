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

/** 找出 ranks 中所有长度 >= minLength 的连续子序列（按 SEQUENCE_RANKS 排列） */
function findConsecutiveRuns(ranks: Rank[], minLength: number): Rank[][] {
  const indices = ranks
    .map((r) => SEQUENCE_RANKS.indexOf(r))
    .filter((i) => i !== -1);
  const uniqueIndices = [...new Set(indices)].sort((a, b) => a - b);

  const runs: Rank[][] = [];
  let currentRun: number[] = [];

  for (const idx of uniqueIndices) {
    if (currentRun.length === 0 || idx === currentRun[currentRun.length - 1] + 1) {
      currentRun.push(idx);
    } else {
      if (currentRun.length >= minLength) {
        // 生成所有长度 >= minLength 的子集
        for (let len = minLength; len <= currentRun.length; len++) {
          for (let start = 0; start <= currentRun.length - len; start++) {
            runs.push(currentRun.slice(start, start + len).map((i) => SEQUENCE_RANKS[i]));
          }
        }
      }
      currentRun = [idx];
    }
  }
  if (currentRun.length >= minLength) {
    for (let len = minLength; len <= currentRun.length; len++) {
      for (let start = 0; start <= currentRun.length - len; start++) {
        runs.push(currentRun.slice(start, start + len).map((i) => SEQUENCE_RANKS[i]));
      }
    }
  }

  // 优先返回较长的连续序列
  runs.sort((a, b) => b.length - a.length);
  return runs;
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
  // R1: 支持翼牌为三条/炸弹时的多种分解方式
  {
    // 收集所有可能作为飞机主体的三张组合（包括从 quad 中降级）
    const candidateTriples: Rank[] = [...triples];
    for (const q of quads) {
      candidateTriples.push(q);
    }
    // 按 SEQUENCE_RANKS 排序
    candidateTriples.sort(
      (a, b) => SEQUENCE_RANKS.indexOf(a) - SEQUENCE_RANKS.indexOf(b),
    );

    // 找出所有长度 >= MIN_TRIPLE_STRAIGHT_LENGTH 的连续三张子集
    const consecutiveRuns = findConsecutiveRuns(
      candidateTriples,
      MIN_TRIPLE_STRAIGHT_LENGTH,
    );

    for (const run of consecutiveRuns) {
      const tripleCount = run.length;
      const remaining = cards.length - tripleCount * 3;

      // 计算剩余牌数（将 run 中的 rank 各取 3 张后剩余的牌）
      const usedCounts = new Map<Rank, number>();
      for (const r of run) {
        usedCounts.set(r, 3);
      }
      let leftoverCount = 0;
      let leftoverPairs = 0;
      let leftoverSingles = 0;
      for (const [rank, count] of counts) {
        const used = usedCounts.get(rank) ?? 0;
        const left = count - used;
        if (left > 0) {
          leftoverCount += left;
          if (left === 2) leftoverPairs++;
          else if (left === 1) leftoverSingles++;
          else if (left === 4) leftoverPairs += 2;
          else if (left === 3) {
            leftoverPairs++;
            leftoverSingles++;
          }
        }
      }

      // 飞机不带
      if (remaining === 0) {
        return {
          type: CardType.TripleStraight,
          cards,
          mainRank: minRank(run),
          length: tripleCount,
        };
      }

      // 飞机带单
      if (remaining === tripleCount && leftoverCount === tripleCount) {
        return {
          type: CardType.TripleStraightWithOnes,
          cards,
          mainRank: minRank(run),
          length: tripleCount,
        };
      }

      // 飞机带对
      if (
        remaining === tripleCount * 2 &&
        leftoverPairs === tripleCount &&
        leftoverSingles === 0
      ) {
        return {
          type: CardType.TripleStraightWithPairs,
          cards,
          mainRank: minRank(run),
          length: tripleCount,
        };
      }
    }
  }

  return null;
}
