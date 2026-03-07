import { CardType, Rank } from "../types/card.js";
import type { Card, CardPlay } from "../types/card.js";
import {
  SEQUENCE_RANKS,
  WILDCARD_SEQUENCE_RANKS,
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

/** 获取连续序列中的最小 rank（使用指定的 rank 序列） */
function minRank(ranks: Rank[], seqRanks: readonly Rank[] = SEQUENCE_RANKS): Rank {
  const indices = ranks.map((r) => seqRanks.indexOf(r));
  const minIdx = Math.min(...indices);
  return seqRanks[minIdx];
}

// ─────────────────────────────────────────────
// Wildcard helpers
// ─────────────────────────────────────────────

/** 将牌分成自然牌和赖子牌 */
function separateWilds(
  cards: Card[],
  wildcardRank: Rank,
): { naturals: Card[]; wilds: Card[] } {
  const naturals: Card[] = [];
  const wilds: Card[] = [];
  for (const card of cards) {
    if (card.rank === wildcardRank) {
      wilds.push(card);
    } else {
      naturals.push(card);
    }
  }
  return { naturals, wilds };
}

/** 统计自然牌每个 rank 的出现次数 */
function countNaturalRanks(naturals: Card[]): Map<Rank, number> {
  return countRanks(naturals);
}

/**
 * 赖子模式：尝试匹配固定数量的同 rank 牌（如对子=2, 三张=3, 炸弹=4）。
 * 遍历所有可能的目标 rank (3~2)，检查自然牌+赖子是否可凑够 targetCount。
 * 优先使用赖子的自然 rank（即赖子作为本身打出），然后按需要赖子最少的顺序匹配。
 * 返回第一个匹配的 rank，或 null。
 */
function tryMatchFixedCount(
  naturalCounts: Map<Rank, number>,
  wildCount: number,
  totalCards: number,
  targetCount: number,
  wildcardRank: Rank,
): Rank | null {
  if (totalCards !== targetCount) return null;

  // 优先检查赖子本身 rank（赖子保留原始身份）
  {
    const natural = naturalCounts.get(wildcardRank) ?? 0;
    // 赖子 rank 的自然牌数量为 0（因为都被分入了 wilds），所以总数 = wildCount
    // 如果 wildCount >= targetCount，则可以凑成 targetCount 张赖子 rank 的牌
    const totalForWildRank = natural + wildCount;
    if (totalForWildRank >= targetCount) {
      return wildcardRank;
    }
  }

  // 遍历 WILDCARD_SEQUENCE_RANKS（3~2），按需要赖子最少的顺序
  // 先收集所有可能的匹配，按 needed 排序（优先用最少赖子的）
  let bestRank: Rank | null = null;
  let bestNeeded = Infinity;
  for (const rank of WILDCARD_SEQUENCE_RANKS) {
    if (rank === wildcardRank) continue; // 已经检查过了
    const natural = naturalCounts.get(rank) ?? 0;
    const needed = targetCount - natural;
    if (needed >= 0 && needed <= wildCount && needed < bestNeeded) {
      bestNeeded = needed;
      bestRank = rank;
    }
  }
  return bestRank;
}

/**
 * 赖子模式：尝试匹配顺子类（单顺/双顺/三顺）。
 * perRank = 每个 rank 需要多少张（单顺=1, 双顺=2, 三顺=3）
 * minLen = 最短序列长度
 * 返回 { startRank, length } 或 null。
 */
function tryMatchSequence(
  naturalCounts: Map<Rank, number>,
  wildCount: number,
  totalCards: number,
  perRank: number,
  minLen: number,
): { startRank: Rank; length: number } | null {
  const seqRanks = WILDCARD_SEQUENCE_RANKS; // 3~2

  // 尝试每个可能的长度（从长到短，优先匹配最长的序列）
  for (let len = seqRanks.length; len >= minLen; len--) {
    if (totalCards !== len * perRank) continue;

    for (let start = 0; start <= seqRanks.length - len; start++) {
      let wildsNeeded = 0;
      let valid = true;

      for (let i = 0; i < len; i++) {
        const rank = seqRanks[start + i];
        const natural = naturalCounts.get(rank) ?? 0;
        const gap = perRank - natural;
        if (gap < 0) {
          // 这个 rank 有多余的自然牌，不适合这个序列
          valid = false;
          break;
        }
        wildsNeeded += gap;
      }

      if (valid && wildsNeeded <= wildCount && wildsNeeded === wildCount) {
        // 所有赖子都用完了（保证没有多余牌）
        return { startRank: seqRanks[start], length: len };
      }
    }
  }
  return null;
}

/**
 * 赖子模式：尝试匹配飞机系列（连续三张 + 翼牌）。
 * 返回 CardPlay 或 null。
 */
function tryMatchAirplane(
  cards: Card[],
  naturalCounts: Map<Rank, number>,
  wildCount: number,
): CardPlay | null {
  const seqRanks = WILDCARD_SEQUENCE_RANKS;
  const totalCards = cards.length;

  // 尝试每个可能的飞机长度（从长到短）
  for (let tripleCount = Math.floor(seqRanks.length); tripleCount >= MIN_TRIPLE_STRAIGHT_LENGTH; tripleCount--) {
    // 检查各种翼牌类型
    const mainCards = tripleCount * 3;
    const possibleKickerTypes = [
      { kickerCards: 0, type: CardType.TripleStraight as CardType },
      { kickerCards: tripleCount, type: CardType.TripleStraightWithOnes as CardType },
      { kickerCards: tripleCount * 2, type: CardType.TripleStraightWithPairs as CardType },
    ];

    for (const { kickerCards, type } of possibleKickerTypes) {
      if (totalCards !== mainCards + kickerCards) continue;

      // 尝试每个起始位置
      for (let start = 0; start <= seqRanks.length - tripleCount; start++) {
        let wildsForMain = 0;
        let valid = true;

        // 计算飞机主体需要的赖子数
        for (let i = 0; i < tripleCount; i++) {
          const rank = seqRanks[start + i];
          const natural = naturalCounts.get(rank) ?? 0;
          const gap = 3 - Math.min(natural, 3);
          wildsForMain += gap;
        }

        if (wildsForMain > wildCount) continue;

        // 计算剩余的牌（自然牌中不在飞机主体中的，加上剩余赖子）
        const remainingWilds = wildCount - wildsForMain;
        let remainingNaturalCount = 0;
        let remainingPairs = 0;
        let remainingSingles = 0;

        for (const [rank, count] of naturalCounts) {
          // 如果这个 rank 在飞机主体中，减去使用的 3 张
          const inMainIdx = (() => {
            for (let i = 0; i < tripleCount; i++) {
              if (seqRanks[start + i] === rank) return true;
            }
            return false;
          })();

          let left: number;
          if (inMainIdx) {
            left = count - Math.min(count, 3);
          } else {
            left = count;
          }

          if (left > 0) {
            remainingNaturalCount += left;
            if (left === 1) remainingSingles++;
            else if (left === 2) remainingPairs++;
            else if (left === 3) { remainingPairs++; remainingSingles++; }
            else if (left === 4) remainingPairs += 2;
          }
        }

        const totalRemaining = remainingNaturalCount + remainingWilds;

        if (type === CardType.TripleStraight) {
          if (totalRemaining === 0) {
            return {
              type: CardType.TripleStraight,
              cards,
              mainRank: seqRanks[start],
              length: tripleCount,
            };
          }
        } else if (type === CardType.TripleStraightWithOnes) {
          if (totalRemaining === tripleCount) {
            return {
              type: CardType.TripleStraightWithOnes,
              cards,
              mainRank: seqRanks[start],
              length: tripleCount,
            };
          }
        } else if (type === CardType.TripleStraightWithPairs) {
          // 翼牌必须全部是对子。剩余赖子可以和单牌配对，或自己两两配对
          // 需要 tripleCount 对翼牌
          // remainingPairs 已有的自然对子 + 可以由 (remainingSingles + wilds) 凑出的对子
          // 每个单牌+1赖子=1对，每2赖子=1对
          if (totalRemaining === tripleCount * 2) {
            // Check that we can form exactly tripleCount pairs from remaining
            const canFormPairs = checkCanFormPairs(remainingPairs, remainingSingles, remainingWilds, tripleCount);
            if (canFormPairs) {
              return {
                type: CardType.TripleStraightWithPairs,
                cards,
                mainRank: seqRanks[start],
                length: tripleCount,
              };
            }
          }
        }
      }
    }
  }

  return null;
}

/** 检查是否可以用剩余自然牌的对子、单牌和赖子凑出 targetPairs 对 */
function checkCanFormPairs(
  naturalPairs: number,
  naturalSingles: number,
  wilds: number,
  targetPairs: number,
): boolean {
  // 自然对子直接用
  let pairs = naturalPairs;
  let remainingWilds = wilds;

  // 单牌+赖子配对
  const singlesCanPair = Math.min(naturalSingles, remainingWilds);
  pairs += singlesCanPair;
  remainingWilds -= singlesCanPair;

  // 剩余赖子自己配对
  pairs += Math.floor(remainingWilds / 2);

  return pairs >= targetPairs;
}

/**
 * 赖子模式：尝试匹配四带系列（四带二单/四带两对）。
 * 四张主体可以是自然四张或自然牌+赖子凑成的四张。
 */
function tryMatchQuadWithKickers(
  cards: Card[],
  naturalCounts: Map<Rank, number>,
  wildCount: number,
): CardPlay | null {
  const totalCards = cards.length;

  // 遍历所有可能的目标 rank
  for (const targetRank of WILDCARD_SEQUENCE_RANKS) {
    const natural = naturalCounts.get(targetRank) ?? 0;
    const needed = 4 - natural;
    if (needed < 0 || needed > wildCount) continue;

    const remainingWilds = wildCount - needed;
    const remainingCards = totalCards - 4;

    // 计算剩余自然牌
    let remainingNaturalCount = 0;
    let remainingPairs = 0;
    let remainingSingles = 0;
    for (const [rank, count] of naturalCounts) {
      const left = rank === targetRank ? count - Math.min(count, 4) : count;
      if (left > 0) {
        remainingNaturalCount += left;
        if (left === 1) remainingSingles++;
        else if (left === 2) remainingPairs++;
        else if (left === 3) { remainingPairs++; remainingSingles++; }
        else if (left === 4) remainingPairs += 2;
      }
    }

    const totalRemaining = remainingNaturalCount + remainingWilds;

    // 四带二单：4 + 2
    if (remainingCards === 2 && totalRemaining === 2) {
      return { type: CardType.QuadWithTwo, cards, mainRank: targetRank };
    }

    // 四带两对：4 + 4（2对）
    if (remainingCards === 4 && totalRemaining === 4) {
      const canFormPairs = checkCanFormPairs(remainingPairs, remainingSingles, remainingWilds, 2);
      if (canFormPairs) {
        return { type: CardType.QuadWithTwoPairs, cards, mainRank: targetRank };
      }
    }
  }

  return null;
}

/**
 * 赖子模式：尝试匹配三张系列（三张/三带一/三带二）。
 */
function tryMatchTripleWithKickers(
  cards: Card[],
  naturalCounts: Map<Rank, number>,
  wildCount: number,
  wildcardRank: Rank,
): CardPlay | null {
  const totalCards = cards.length;

  // 优先匹配赖子本身 rank，然后按自然牌数量从多到少排序
  const ranksToTry = [...WILDCARD_SEQUENCE_RANKS].sort((a, b) => {
    // 赖子 rank 最优先（保留原始身份）
    if (a === wildcardRank && b !== wildcardRank) return -1;
    if (b === wildcardRank && a !== wildcardRank) return 1;
    const naturalA = naturalCounts.get(a) ?? 0;
    const naturalB = naturalCounts.get(b) ?? 0;
    if (naturalA !== naturalB) return naturalB - naturalA; // 更多自然牌优先
    return b - a; // 相同时高 rank 优先
  });

  for (const targetRank of ranksToTry) {
    const natural = naturalCounts.get(targetRank) ?? 0;
    const needed = 3 - natural;
    if (needed < 0 || needed > wildCount) continue;

    const remainingWilds = wildCount - needed;
    const remainingCards = totalCards - 3;

    // 计算剩余自然牌
    let remainingNaturalCount = 0;
    let remainingPairs = 0;
    let remainingSingles = 0;
    for (const [rank, count] of naturalCounts) {
      const left = rank === targetRank ? count - Math.min(count, 3) : count;
      if (left > 0) {
        remainingNaturalCount += left;
        if (left === 1) remainingSingles++;
        else if (left === 2) remainingPairs++;
        else if (left === 3) { remainingPairs++; remainingSingles++; }
        else if (left === 4) remainingPairs += 2;
      }
    }

    const totalRemaining = remainingNaturalCount + remainingWilds;

    // 三张
    if (remainingCards === 0 && totalRemaining === 0) {
      return { type: CardType.Triple, cards, mainRank: targetRank };
    }

    // 三带一
    if (remainingCards === 1 && totalRemaining === 1) {
      return { type: CardType.TripleWithOne, cards, mainRank: targetRank };
    }

    // 三带二（必须是一对）
    if (remainingCards === 2 && totalRemaining === 2) {
      const canFormPairs = checkCanFormPairs(remainingPairs, remainingSingles, remainingWilds, 1);
      if (canFormPairs) {
        return { type: CardType.TripleWithPair, cards, mainRank: targetRank };
      }
    }
  }

  return null;
}

/**
 * 识别一组牌的牌型。
 * 返回 CardPlay 或 null（无效牌型）。
 *
 * 判定顺序：火箭 → 单张 → 对子 → 炸弹 → 四带二系列（优先于飞机）→ 三张系列 → 顺子 → 连对 → 飞机系列
 *
 * @param cards 要识别的牌
 * @param wildcardRank 赖子的 rank（为 null/undefined 时不启用赖子模式）
 */
export function identifyCardType(cards: Card[], wildcardRank?: Rank | null): CardPlay | null {
  if (cards.length === 0) return null;

  // ──────────────────────────────────────────
  // 火箭：大小王（赖子不能替代）
  // ──────────────────────────────────────────
  if (
    cards.length === 2 &&
    cards.some((c) => c.rank === Rank.BlackJoker) &&
    cards.some((c) => c.rank === Rank.RedJoker)
  ) {
    return { type: CardType.Rocket, cards, mainRank: Rank.RedJoker };
  }

  // 如果没有赖子模式，走原始逻辑
  if (wildcardRank == null) {
    return identifyCardTypeClassic(cards);
  }

  // ──────────────────────────────────────────
  // 赖子模式
  // ──────────────────────────────────────────
  return identifyCardTypeWild(cards, wildcardRank);
}

/** 原始牌型识别（无赖子） */
function identifyCardTypeClassic(cards: Card[]): CardPlay | null {
  const counts = countRanks(cards);
  const { quads, triples, pairs, singles } = groupByCount(counts);

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

    if (remaining === 2 && triples.length === 0) {
      return { type: CardType.QuadWithTwo, cards, mainRank: quadRank };
    }

    if (remaining === 4 && pairs.length === 2 && triples.length === 0 && singles.length === 0) {
      return { type: CardType.QuadWithTwoPairs, cards, mainRank: quadRank };
    }
  }

  // 三张系列
  if (triples.length === 1 && quads.length === 0) {
    const tripleRank = triples[0];
    const remaining = cards.length - 3;

    if (remaining === 0) {
      return { type: CardType.Triple, cards, mainRank: tripleRank };
    }
    if (remaining === 1) {
      return { type: CardType.TripleWithOne, cards, mainRank: tripleRank };
    }
    if (remaining === 2 && pairs.length === 1) {
      return { type: CardType.TripleWithPair, cards, mainRank: tripleRank };
    }
  }

  // 顺子
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

  // 连对
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

  // 飞机系列
  {
    const candidateTriples: Rank[] = [...triples];
    for (const q of quads) {
      candidateTriples.push(q);
    }
    candidateTriples.sort(
      (a, b) => SEQUENCE_RANKS.indexOf(a) - SEQUENCE_RANKS.indexOf(b),
    );

    const consecutiveRuns = findConsecutiveRuns(
      candidateTriples,
      MIN_TRIPLE_STRAIGHT_LENGTH,
    );

    for (const run of consecutiveRuns) {
      const tripleCount = run.length;
      const remaining = cards.length - tripleCount * 3;

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

      if (remaining === 0) {
        return {
          type: CardType.TripleStraight,
          cards,
          mainRank: minRank(run),
          length: tripleCount,
        };
      }

      if (remaining === tripleCount && leftoverCount === tripleCount) {
        return {
          type: CardType.TripleStraightWithOnes,
          cards,
          mainRank: minRank(run),
          length: tripleCount,
        };
      }

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

/** 赖子模式牌型识别 */
function identifyCardTypeWild(cards: Card[], wildcardRank: Rank): CardPlay | null {
  const { naturals, wilds } = separateWilds(cards, wildcardRank);
  const wildCount = wilds.length;
  const naturalCounts = countNaturalRanks(naturals);
  const totalCards = cards.length;

  // ──────────────────────────────────────────
  // 单张
  // ──────────────────────────────────────────
  if (totalCards === 1) {
    return { type: CardType.Single, cards, mainRank: cards[0].rank };
  }

  // ──────────────────────────────────────────
  // 对子
  // ──────────────────────────────────────────
  if (totalCards === 2) {
    const rank = tryMatchFixedCount(naturalCounts, wildCount, totalCards, 2, wildcardRank);
    if (rank != null) {
      return { type: CardType.Pair, cards, mainRank: rank };
    }
    // 2 cards, not a pair, not a rocket → null
    return null;
  }

  // ──────────────────────────────────────────
  // 炸弹（4 张）— 优先检查硬炸/纯赖子炸/软炸
  // ──────────────────────────────────────────
  if (totalCards === 4) {
    // 纯赖子炸：4 张全是赖子
    if (wildCount === 4) {
      return { type: CardType.Bomb, cards, mainRank: wildcardRank, pureWild: true };
    }

    // 硬炸：4 张自然牌相同 rank（无赖子参与）
    if (wildCount === 0) {
      const allCounts = countRanks(cards);
      const groups = groupByCount(allCounts);
      if (groups.quads.length === 1) {
        return { type: CardType.Bomb, cards, mainRank: groups.quads[0] };
      }
    }

    // 软炸：自然牌+赖子凑成 4 张同 rank
    if (wildCount > 0) {
      for (const targetRank of WILDCARD_SEQUENCE_RANKS) {
        const natural = naturalCounts.get(targetRank) ?? 0;
        const needed = 4 - natural;
        if (needed > 0 && needed <= wildCount && natural + wildCount === 4) {
          return { type: CardType.Bomb, cards, mainRank: targetRank, softBomb: true };
        }
      }
    }
  }

  // ──────────────────────────────────────────
  // 三张系列（三张/三带一/三带二）
  // ──────────────────────────────────────────
  if (totalCards >= 3 && totalCards <= 5) {
    const tripleResult = tryMatchTripleWithKickers(cards, naturalCounts, wildCount, wildcardRank);
    if (tripleResult) return tripleResult;
  }

  // ──────────────────────────────────────────
  // 顺子：5+ 张连续单张（赖子可填补空缺）
  // ──────────────────────────────────────────
  if (totalCards >= MIN_STRAIGHT_LENGTH) {
    const seqResult = tryMatchSequence(
      naturalCounts, wildCount, totalCards, 1, MIN_STRAIGHT_LENGTH,
    );
    if (seqResult) {
      return {
        type: CardType.Straight,
        cards,
        mainRank: seqResult.startRank,
        length: seqResult.length,
      };
    }
  }

  // ──────────────────────────────────────────
  // 连对：3+ 对连续对子
  // ──────────────────────────────────────────
  if (totalCards >= MIN_DOUBLE_STRAIGHT_LENGTH * 2 && totalCards % 2 === 0) {
    const seqResult = tryMatchSequence(
      naturalCounts, wildCount, totalCards, 2, MIN_DOUBLE_STRAIGHT_LENGTH,
    );
    if (seqResult) {
      return {
        type: CardType.DoubleStraight,
        cards,
        mainRank: seqResult.startRank,
        length: seqResult.length,
      };
    }
  }

  // ──────────────────────────────────────────
  // 飞机系列
  // ──────────────────────────────────────────
  {
    const airplaneResult = tryMatchAirplane(cards, naturalCounts, wildCount);
    if (airplaneResult) return airplaneResult;
  }

  // ──────────────────────────────────────────
  // 四带二系列（在赖子模式中放在顺子/连对/飞机之后，避免赖子过度匹配四带）
  // ──────────────────────────────────────────
  if (totalCards === 6 || totalCards === 8) {
    const quadResult = tryMatchQuadWithKickers(cards, naturalCounts, wildCount);
    if (quadResult) return quadResult;
  }

  return null;
}
