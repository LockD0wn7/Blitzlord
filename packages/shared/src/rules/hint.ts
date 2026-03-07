import {
  MIN_DOUBLE_STRAIGHT_LENGTH,
  MIN_STRAIGHT_LENGTH,
  MIN_TRIPLE_STRAIGHT_LENGTH,
  SEQUENCE_RANKS,
  WILDCARD_SEQUENCE_RANKS,
} from "../constants/card.js";
import { CardType, Rank } from "../types/card.js";
import type { Card, CardPlay } from "../types/card.js";
import { sortCards } from "../utils/sort.js";
import { canBeat } from "./cardCompare.js";
import { identifyCardType } from "./cardType.js";

const PLAY_PRIORITY: Record<CardType, number> = {
  [CardType.Single]: 0,
  [CardType.Pair]: 1,
  [CardType.Triple]: 2,
  [CardType.TripleWithOne]: 3,
  [CardType.TripleWithPair]: 4,
  [CardType.Straight]: 5,
  [CardType.DoubleStraight]: 6,
  [CardType.TripleStraight]: 7,
  [CardType.TripleStraightWithOnes]: 8,
  [CardType.TripleStraightWithPairs]: 9,
  [CardType.QuadWithTwo]: 10,
  [CardType.QuadWithTwoPairs]: 11,
  [CardType.Bomb]: 12,
  [CardType.Rocket]: 13,
};

interface UnitOption {
  rank: Rank;
  maxUnits: number;
}

function buildGroupedCards(hand: Card[]): Map<Rank, Card[]> {
  const grouped = new Map<Rank, Card[]>();

  for (const card of sortCards(hand)) {
    const current = grouped.get(card.rank) ?? [];
    current.push(card);
    grouped.set(card.rank, current);
  }

  return grouped;
}

function buildCountMap(grouped: Map<Rank, Card[]>): Map<Rank, number> {
  const counts = new Map<Rank, number>();

  for (const [rank, cards] of grouped) {
    counts.set(rank, cards.length);
  }

  return counts;
}

function subtractCounts(
  counts: Map<Rank, number>,
  selection: Map<Rank, number>,
): Map<Rank, number> {
  const remaining = new Map(counts);

  for (const [rank, used] of selection) {
    remaining.set(rank, Math.max(0, (remaining.get(rank) ?? 0) - used));
  }

  return remaining;
}

function buildUnitOptions(
  counts: Map<Rank, number>,
  unitSize: number,
): UnitOption[] {
  return [...counts.entries()]
    .map(([rank, count]) => ({
      rank,
      maxUnits: Math.floor(count / unitSize),
    }))
    .filter((entry) => entry.maxUnits > 0)
    .sort((a, b) => a.rank - b.rank);
}

function chooseUnits(
  options: UnitOption[],
  totalUnits: number,
): Rank[][] {
  const result: Rank[][] = [];
  const current: Rank[] = [];

  function walk(index: number, remaining: number) {
    if (remaining === 0) {
      result.push([...current]);
      return;
    }

    if (index >= options.length) {
      return;
    }

    const option = options[index];
    const maxTake = Math.min(option.maxUnits, remaining);

    for (let take = 0; take <= maxTake; take++) {
      for (let i = 0; i < take; i++) {
        current.push(option.rank);
      }

      walk(index + 1, remaining - take);

      for (let i = 0; i < take; i++) {
        current.pop();
      }
    }
  }

  walk(0, totalUnits);
  return result;
}

function findConsecutiveRuns(
  ranks: Rank[],
  minLength: number,
): Rank[][] {
  const indices = ranks
    .map((rank) => SEQUENCE_RANKS.indexOf(rank))
    .filter((index) => index !== -1)
    .sort((a, b) => a - b);

  const uniqueIndices = [...new Set(indices)];
  const result: Rank[][] = [];
  let segment: number[] = [];

  const flushSegment = () => {
    if (segment.length < minLength) {
      segment = [];
      return;
    }

    for (let length = minLength; length <= segment.length; length++) {
      for (let start = 0; start <= segment.length - length; start++) {
        result.push(
          segment
            .slice(start, start + length)
            .map((index) => SEQUENCE_RANKS[index]),
        );
      }
    }

    segment = [];
  };

  for (const index of uniqueIndices) {
    if (
      segment.length === 0 ||
      index === segment[segment.length - 1] + 1
    ) {
      segment.push(index);
      continue;
    }

    flushSegment();
    segment.push(index);
  }

  flushSegment();
  return result;
}

function addRanksToSelection(
  selection: Map<Rank, number>,
  ranks: Rank[],
  cardsPerRank: number,
) {
  for (const rank of ranks) {
    selection.set(rank, (selection.get(rank) ?? 0) + cardsPerRank);
  }
}

function buildCardsFromSelection(
  grouped: Map<Rank, Card[]>,
  selection: Map<Rank, number>,
): Card[] | null {
  const cards: Card[] = [];

  for (const [rank, needed] of selection) {
    const available = grouped.get(rank);
    if (!available || available.length < needed) {
      return null;
    }

    cards.push(...available.slice(0, needed));
  }

  return sortCards(cards);
}

function getPlayKey(play: CardPlay): string {
  const rankSignature = [...play.cards]
    .map((card) => card.rank)
    .sort((a, b) => a - b)
    .join(",");

  return [
    play.type,
    String(play.mainRank),
    String(play.length ?? 0),
    rankSignature,
  ].join("|");
}

function getRankSignature(play: CardPlay): number[] {
  return [...play.cards]
    .map((card) => card.rank)
    .sort((a, b) => a - b);
}

function compareRankSignature(left: number[], right: number[]): number {
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const diff = (left[index] ?? -1) - (right[index] ?? -1);
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}

function comparePlays(left: CardPlay, right: CardPlay): number {
  const priorityDiff = PLAY_PRIORITY[left.type] - PLAY_PRIORITY[right.type];
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  const leftLength = left.length ?? 0;
  const rightLength = right.length ?? 0;
  if (leftLength !== rightLength) {
    return leftLength - rightLength;
  }

  if (left.mainRank !== right.mainRank) {
    return left.mainRank - right.mainRank;
  }

  return compareRankSignature(
    getRankSignature(left),
    getRankSignature(right),
  );
}

function pushCandidate(
  result: CardPlay[],
  seen: Set<string>,
  grouped: Map<Rank, Card[]>,
  previousPlay: CardPlay | null,
  selection: Map<Rank, number>,
) {
  const cards = buildCardsFromSelection(grouped, selection);
  if (!cards) {
    return;
  }

  const play = identifyCardType(cards);
  if (!play) {
    return;
  }

  if (previousPlay && !canBeat(play, previousPlay)) {
    return;
  }

  const key = getPlayKey(play);
  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  result.push(play);
}

// ─────────────────────────────────────────────
// Wildcard hint helpers
// ─────────────────────────────────────────────

/**
 * 从手牌中构建一组物理牌，用于指定目标牌型。
 * targetRanks: 目标牌型中每个 rank 需要的张数
 * naturalGrouped: 自然牌按 rank 分组
 * wildCards: 赖子牌数组
 *
 * 返回物理牌数组或 null（如果无法凑齐）
 */
function buildWildCards(
  targetRanks: Map<Rank, number>,
  naturalGrouped: Map<Rank, Card[]>,
  wildCards: Card[],
): Card[] | null {
  const cards: Card[] = [];
  let wildsUsed = 0;

  for (const [rank, needed] of targetRanks) {
    const available = naturalGrouped.get(rank) ?? [];
    const naturalUse = Math.min(available.length, needed);
    cards.push(...available.slice(0, naturalUse));

    const gap = needed - naturalUse;
    if (gap > 0) {
      if (wildsUsed + gap > wildCards.length) {
        return null;
      }
      cards.push(...wildCards.slice(wildsUsed, wildsUsed + gap));
      wildsUsed += gap;
    }
  }

  return sortCards(cards);
}

/**
 * 赖子模式的 pushCandidate：构建物理牌 → identifyCardType(cards, wildcardRank) → canBeat → 去重
 */
function pushWildCandidate(
  result: CardPlay[],
  seen: Set<string>,
  previousPlay: CardPlay | null,
  cards: Card[],
  wildcardRank: Rank,
) {
  const play = identifyCardType(cards, wildcardRank);
  if (!play) {
    return;
  }

  if (previousPlay && !canBeat(play, previousPlay)) {
    return;
  }

  const key = getPlayKey(play);
  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  result.push(play);
}

/**
 * 赖子模式下的提示枚举。
 *
 * 策略：将手牌分为自然牌和赖子牌，然后对每种牌型类别，
 * 枚举所有可能的目标 rank 组合（用赖子填补空缺），
 * 构建物理牌后用 identifyCardType 验证。
 */
function getPlayableHintsWild(
  hand: Card[],
  previousPlay: CardPlay | null,
  wildcardRank: Rank,
): CardPlay[] {
  const result: CardPlay[] = [];
  const seen = new Set<string>();

  // 分离自然牌和赖子
  const naturalCards: Card[] = [];
  const wildCards: Card[] = [];
  for (const card of hand) {
    if (card.rank === wildcardRank) {
      wildCards.push(card);
    } else {
      naturalCards.push(card);
    }
  }
  const wildCount = wildCards.length;

  // 自然牌按 rank 分组
  const naturalGrouped = new Map<Rank, Card[]>();
  for (const card of sortCards(naturalCards)) {
    const current = naturalGrouped.get(card.rank) ?? [];
    current.push(card);
    naturalGrouped.set(card.rank, current);
  }

  // 自然牌每 rank 的数量
  const naturalCounts = new Map<Rank, number>();
  for (const [rank, cards] of naturalGrouped) {
    naturalCounts.set(rank, cards.length);
  }

  // 所有可能的目标 rank（用于单牌/对子/三条/炸弹）
  const allTargetRanks = [...WILDCARD_SEQUENCE_RANKS, Rank.BlackJoker, Rank.RedJoker];

  // ──────────────────────────────────────────
  // 单牌：每张自然牌 + 每张赖子作为自身
  // ──────────────────────────────────────────
  for (const rank of allTargetRanks) {
    const natural = naturalGrouped.get(rank);
    if (natural && natural.length > 0) {
      pushWildCandidate(result, seen, previousPlay, [natural[0]], wildcardRank);
    }
  }
  // 赖子作为自身打出单牌
  if (wildCount > 0) {
    pushWildCandidate(result, seen, previousPlay, [wildCards[0]], wildcardRank);
  }

  // ──────────────────────────────────────────
  // 对子：遍历所有 rank，检查自然牌 + 赖子能否凑 2 张
  // ──────────────────────────────────────────
  for (const targetRank of allTargetRanks) {
    if (targetRank === Rank.BlackJoker || targetRank === Rank.RedJoker) continue;
    const natural = naturalCounts.get(targetRank) ?? 0;
    // 赖子 rank 的自然牌数为 0（全被分到 wildCards），但 targetRank === wildcardRank 时赖子可以用自身
    const effectiveNatural = targetRank === wildcardRank ? wildCount : natural;
    const wildsAvailable = targetRank === wildcardRank ? 0 : wildCount;

    if (effectiveNatural >= 2) {
      // 纯自然/纯赖子凑对
      const target = new Map<Rank, number>([[targetRank, 2]]);
      const cards = buildWildCards(target, naturalGrouped, wildCards);
      if (cards) {
        pushWildCandidate(result, seen, previousPlay, cards, wildcardRank);
      }
    } else if (effectiveNatural + wildsAvailable >= 2) {
      const target = new Map<Rank, number>([[targetRank, 2]]);
      const cards = buildWildCards(target, naturalGrouped, wildCards);
      if (cards) {
        pushWildCandidate(result, seen, previousPlay, cards, wildcardRank);
      }
    }
  }

  // ──────────────────────────────────────────
  // 三条：遍历所有 rank，检查自然牌 + 赖子能否凑 3 张
  // ──────────────────────────────────────────
  for (const targetRank of WILDCARD_SEQUENCE_RANKS) {
    const natural = targetRank === wildcardRank ? 0 : (naturalCounts.get(targetRank) ?? 0);
    const wildsAvail = targetRank === wildcardRank ? wildCount : wildCount;
    const effectiveTotal = targetRank === wildcardRank ? wildCount : natural + wildCount;

    if (effectiveTotal >= 3) {
      const target = new Map<Rank, number>([[targetRank, 3]]);
      const cards = buildWildCards(target, naturalGrouped, wildCards);
      if (cards) {
        pushWildCandidate(result, seen, previousPlay, cards, wildcardRank);
      }
    }
  }

  // ──────────────────────────────────────────
  // 炸弹：硬炸 + 软炸 + 纯赖子炸
  // ──────────────────────────────────────────
  // 纯赖子炸
  if (wildCount >= 4) {
    pushWildCandidate(
      result, seen, previousPlay,
      wildCards.slice(0, 4),
      wildcardRank,
    );
  }

  for (const targetRank of WILDCARD_SEQUENCE_RANKS) {
    const natural = targetRank === wildcardRank ? 0 : (naturalCounts.get(targetRank) ?? 0);
    const effectiveTotal = targetRank === wildcardRank ? wildCount : natural + wildCount;

    if (effectiveTotal >= 4) {
      const target = new Map<Rank, number>([[targetRank, 4]]);
      const cards = buildWildCards(target, naturalGrouped, wildCards);
      if (cards) {
        pushWildCandidate(result, seen, previousPlay, cards, wildcardRank);
      }
    }
  }

  // ──────────────────────────────────────────
  // 火箭：不受赖子影响
  // ──────────────────────────────────────────
  {
    const hasBlack = naturalGrouped.has(Rank.BlackJoker) || wildcardRank === Rank.BlackJoker;
    const hasRed = naturalGrouped.has(Rank.RedJoker) || wildcardRank === Rank.RedJoker;
    if (hasBlack && hasRed) {
      const blackCard = naturalGrouped.get(Rank.BlackJoker)?.[0];
      const redCard = naturalGrouped.get(Rank.RedJoker)?.[0];
      if (blackCard && redCard) {
        pushWildCandidate(
          result, seen, previousPlay,
          sortCards([blackCard, redCard]),
          wildcardRank,
        );
      }
    }
  }

  // ──────────────────────────────────────────
  // 三带一 / 三带二
  // ──────────────────────────────────────────
  for (const targetRank of WILDCARD_SEQUENCE_RANKS) {
    const natural = targetRank === wildcardRank ? 0 : (naturalCounts.get(targetRank) ?? 0);
    const effectiveTotal = targetRank === wildcardRank ? wildCount : natural + wildCount;
    if (effectiveTotal < 3) continue;

    // 计算凑三条用了多少赖子
    const wildsForTriple = Math.max(0, 3 - (targetRank === wildcardRank ? 0 : natural));
    const remainingWilds = wildCount - wildsForTriple;

    // 构建三条的物理牌
    const tripleCards: Card[] = [];
    const naturalAvail = targetRank === wildcardRank ? [] : (naturalGrouped.get(targetRank) ?? []);
    const naturalUse = Math.min(naturalAvail.length, 3);
    tripleCards.push(...naturalAvail.slice(0, naturalUse));
    tripleCards.push(...wildCards.slice(0, wildsForTriple));

    // 剩余自然牌（不含已用的）
    const remainingNatural: Card[] = [];
    for (const [rank, cards] of naturalGrouped) {
      if (rank === targetRank) {
        remainingNatural.push(...cards.slice(naturalUse));
      } else {
        remainingNatural.push(...cards);
      }
    }
    const remainingWildCards = wildCards.slice(wildsForTriple);

    // 三带一：从剩余自然牌和赖子中选 1 张
    const kickerSingles = new Set<Rank>();
    for (const card of remainingNatural) {
      if (!kickerSingles.has(card.rank)) {
        kickerSingles.add(card.rank);
        pushWildCandidate(
          result, seen, previousPlay,
          sortCards([...tripleCards, card]),
          wildcardRank,
        );
      }
    }
    if (remainingWildCards.length > 0) {
      pushWildCandidate(
        result, seen, previousPlay,
        sortCards([...tripleCards, remainingWildCards[0]]),
        wildcardRank,
      );
    }

    // 三带二：从剩余中凑一对
    // 遍历所有可能的对子 rank
    for (const pairRank of WILDCARD_SEQUENCE_RANKS) {
      if (pairRank === targetRank && naturalAvail.length - naturalUse < 2 && pairRank !== wildcardRank) {
        // 不够凑对子（且不是赖子rank）
      }
      const pairNatural = pairRank === targetRank
        ? (naturalAvail.length - naturalUse)
        : pairRank === wildcardRank
          ? 0
          : (naturalCounts.get(pairRank) ?? 0);
      const pairEffective = pairRank === wildcardRank
        ? remainingWilds
        : pairNatural + remainingWilds;

      if (pairEffective >= 2) {
        // Build kicker pair cards
        const kickerCards: Card[] = [];
        const pairNaturalAvail = pairRank === targetRank
          ? naturalAvail.slice(naturalUse)
          : pairRank === wildcardRank
            ? []
            : (naturalGrouped.get(pairRank) ?? []);
        const pairNaturalUse = Math.min(pairNaturalAvail.length, 2);
        kickerCards.push(...pairNaturalAvail.slice(0, pairNaturalUse));
        const pairWildsNeeded = 2 - pairNaturalUse;
        if (pairWildsNeeded > remainingWilds) continue;
        kickerCards.push(...remainingWildCards.slice(0, pairWildsNeeded));

        pushWildCandidate(
          result, seen, previousPlay,
          sortCards([...tripleCards, ...kickerCards]),
          wildcardRank,
        );
      }
    }
    // Also handle joker pairs for kickers (unlikely but for completeness)
    for (const jokerRank of [Rank.BlackJoker, Rank.RedJoker]) {
      const jokerNatural = naturalCounts.get(jokerRank) ?? 0;
      if (jokerNatural >= 2) {
        const jokerCards = naturalGrouped.get(jokerRank)!.slice(0, 2);
        pushWildCandidate(
          result, seen, previousPlay,
          sortCards([...tripleCards, ...jokerCards]),
          wildcardRank,
        );
      }
    }
  }

  // ──────────────────────────────────────────
  // 顺子：使用 WILDCARD_SEQUENCE_RANKS (3~2)，赖子填补空缺
  // ──────────────────────────────────────────
  {
    const seqRanks = WILDCARD_SEQUENCE_RANKS;
    for (let len = MIN_STRAIGHT_LENGTH; len <= seqRanks.length; len++) {
      for (let start = 0; start <= seqRanks.length - len; start++) {
        let wildsNeeded = 0;
        let valid = true;

        for (let i = 0; i < len; i++) {
          const rank = seqRanks[start + i];
          const natural = rank === wildcardRank ? 0 : (naturalCounts.get(rank) ?? 0);
          if (natural >= 1) {
            // have natural card for this position
          } else {
            wildsNeeded++;
          }
        }

        if (wildsNeeded > wildCount) continue;

        // Build the cards
        const seqCards: Card[] = [];
        let wildsUsed = 0;
        for (let i = 0; i < len; i++) {
          const rank = seqRanks[start + i];
          const natural = rank === wildcardRank ? [] : (naturalGrouped.get(rank) ?? []);
          if (natural.length > 0) {
            seqCards.push(natural[0]);
          } else {
            seqCards.push(wildCards[wildsUsed++]);
          }
        }

        pushWildCandidate(result, seen, previousPlay, sortCards(seqCards), wildcardRank);
      }
    }
  }

  // ──────────────────────────────────────────
  // 连对：使用 WILDCARD_SEQUENCE_RANKS，赖子填补空缺
  // ──────────────────────────────────────────
  {
    const seqRanks = WILDCARD_SEQUENCE_RANKS;
    for (let len = MIN_DOUBLE_STRAIGHT_LENGTH; len <= seqRanks.length; len++) {
      for (let start = 0; start <= seqRanks.length - len; start++) {
        let wildsNeeded = 0;

        for (let i = 0; i < len; i++) {
          const rank = seqRanks[start + i];
          const natural = rank === wildcardRank ? 0 : (naturalCounts.get(rank) ?? 0);
          const gap = 2 - Math.min(natural, 2);
          wildsNeeded += gap;
        }

        if (wildsNeeded > wildCount) continue;

        // Build the cards
        const dsCards: Card[] = [];
        let wildsUsed = 0;
        for (let i = 0; i < len; i++) {
          const rank = seqRanks[start + i];
          const natural = rank === wildcardRank ? [] : (naturalGrouped.get(rank) ?? []);
          const naturalUse = Math.min(natural.length, 2);
          dsCards.push(...natural.slice(0, naturalUse));
          const gap = 2 - naturalUse;
          for (let w = 0; w < gap; w++) {
            dsCards.push(wildCards[wildsUsed++]);
          }
        }

        pushWildCandidate(result, seen, previousPlay, sortCards(dsCards), wildcardRank);
      }
    }
  }

  // ──────────────────────────────────────────
  // 飞机系列：使用 WILDCARD_SEQUENCE_RANKS，赖子填补三条空缺
  // ──────────────────────────────────────────
  {
    const seqRanks = WILDCARD_SEQUENCE_RANKS;
    for (let tripleCount = MIN_TRIPLE_STRAIGHT_LENGTH; tripleCount <= seqRanks.length; tripleCount++) {
      for (let start = 0; start <= seqRanks.length - tripleCount; start++) {
        let wildsForMain = 0;

        for (let i = 0; i < tripleCount; i++) {
          const rank = seqRanks[start + i];
          const natural = rank === wildcardRank ? 0 : (naturalCounts.get(rank) ?? 0);
          const gap = 3 - Math.min(natural, 3);
          wildsForMain += gap;
        }

        if (wildsForMain > wildCount) continue;

        // Build main body cards
        const mainCards: Card[] = [];
        let wildsUsed = 0;
        for (let i = 0; i < tripleCount; i++) {
          const rank = seqRanks[start + i];
          const natural = rank === wildcardRank ? [] : (naturalGrouped.get(rank) ?? []);
          const naturalUse = Math.min(natural.length, 3);
          mainCards.push(...natural.slice(0, naturalUse));
          const gap = 3 - naturalUse;
          for (let w = 0; w < gap; w++) {
            mainCards.push(wildCards[wildsUsed++]);
          }
        }

        const remainingWilds = wildCount - wildsForMain;

        // 剩余自然牌
        const remainingNatural: Card[] = [];
        for (const [rank, cards] of naturalGrouped) {
          const isInMain = (() => {
            for (let i = 0; i < tripleCount; i++) {
              if (seqRanks[start + i] === rank) return true;
            }
            return false;
          })();
          if (isInMain) {
            const used = Math.min(cards.length, 3);
            remainingNatural.push(...cards.slice(used));
          } else {
            remainingNatural.push(...cards);
          }
        }
        const remainingWildCards = wildCards.slice(wildsForMain);

        // 纯飞机（无翼牌）
        if (remainingWilds === 0 && remainingNatural.length === 0 ||
          // 也允许有剩余但只出飞机主体
          true) {
          pushWildCandidate(result, seen, previousPlay, sortCards([...mainCards]), wildcardRank);
        }

        // 飞机带单：需要 tripleCount 张翼牌
        {
          // 从剩余中选 tripleCount 张单牌
          const allRemaining = [...remainingNatural, ...remainingWildCards];
          if (allRemaining.length >= tripleCount) {
            // 选择翼牌组合（用 chooseUnits 的简化版：直接取前 tripleCount 张不同 rank 的牌）
            const kickerCombinations = chooseKickers(
              remainingNatural, remainingWildCards, tripleCount, 1,
            );
            for (const kickers of kickerCombinations) {
              pushWildCandidate(
                result, seen, previousPlay,
                sortCards([...mainCards, ...kickers]),
                wildcardRank,
              );
            }
          }
        }

        // 飞机带对：需要 tripleCount 对翼牌
        {
          const kickerCombinations = chooseKickers(
            remainingNatural, remainingWildCards, tripleCount, 2,
          );
          for (const kickers of kickerCombinations) {
            pushWildCandidate(
              result, seen, previousPlay,
              sortCards([...mainCards, ...kickers]),
              wildcardRank,
            );
          }
        }
      }
    }
  }

  // ──────────────────────────────────────────
  // 四带二单 / 四带两对
  // ──────────────────────────────────────────
  for (const targetRank of WILDCARD_SEQUENCE_RANKS) {
    const natural = targetRank === wildcardRank ? 0 : (naturalCounts.get(targetRank) ?? 0);
    const effectiveTotal = targetRank === wildcardRank ? wildCount : natural + wildCount;
    if (effectiveTotal < 4) continue;

    const wildsForQuad = Math.max(0, 4 - (targetRank === wildcardRank ? 0 : natural));
    if (wildsForQuad > wildCount) continue;

    // Build quad cards
    const quadCards: Card[] = [];
    const naturalAvail = targetRank === wildcardRank ? [] : (naturalGrouped.get(targetRank) ?? []);
    const naturalUse = Math.min(naturalAvail.length, 4);
    quadCards.push(...naturalAvail.slice(0, naturalUse));
    quadCards.push(...wildCards.slice(0, wildsForQuad));

    // 剩余牌
    const remainingNatural: Card[] = [];
    for (const [rank, cards] of naturalGrouped) {
      if (rank === targetRank) {
        remainingNatural.push(...cards.slice(naturalUse));
      } else {
        remainingNatural.push(...cards);
      }
    }
    const remainingWildCards = wildCards.slice(wildsForQuad);

    // 四带二单
    {
      const kickerCombinations = chooseKickers(remainingNatural, remainingWildCards, 2, 1);
      for (const kickers of kickerCombinations) {
        pushWildCandidate(
          result, seen, previousPlay,
          sortCards([...quadCards, ...kickers]),
          wildcardRank,
        );
      }
    }

    // 四带两对
    {
      const kickerCombinations = chooseKickers(remainingNatural, remainingWildCards, 2, 2);
      for (const kickers of kickerCombinations) {
        pushWildCandidate(
          result, seen, previousPlay,
          sortCards([...quadCards, ...kickers]),
          wildcardRank,
        );
      }
    }
  }

  return result.sort(comparePlays);
}

/**
 * 从剩余牌中选择翼牌组合。
 * unitCount: 需要多少个单元（如飞机带单需 tripleCount 个单牌，带对需 tripleCount 对）
 * unitSize: 每个单元的大小（1=单牌, 2=对子）
 *
 * 返回所有可能的翼牌组合（每个组合是 Card[]）
 */
function chooseKickers(
  remainingNatural: Card[],
  remainingWilds: Card[],
  unitCount: number,
  unitSize: number,
): Card[][] {
  const totalNeeded = unitCount * unitSize;
  const totalAvail = remainingNatural.length + remainingWilds.length;
  if (totalAvail < totalNeeded) return [];

  if (unitSize === 1) {
    // 单牌翼牌：从剩余牌中选 unitCount 张
    return chooseNCards(remainingNatural, remainingWilds, unitCount);
  }

  // 对子翼牌：需要 unitCount 对，每对2张同rank
  return choosePairKickers(remainingNatural, remainingWilds, unitCount);
}

/**
 * 从剩余中选 n 张牌的所有组合
 */
function chooseNCards(
  naturals: Card[],
  wilds: Card[],
  n: number,
): Card[][] {
  // 简化：按 rank 去重，每个 rank 只取 1 张，再加上赖子
  const result: Card[][] = [];
  const byRank: Card[] = [];
  const seenRanks = new Set<Rank>();

  for (const card of naturals) {
    if (!seenRanks.has(card.rank)) {
      seenRanks.add(card.rank);
      byRank.push(card);
    }
  }

  // 加入赖子作为独立选项
  for (const wild of wilds) {
    byRank.push(wild);
  }

  // 组合选 n 个
  const indices: number[] = [];
  function walk(start: number) {
    if (indices.length === n) {
      result.push(indices.map((i) => byRank[i]));
      return;
    }
    if (start >= byRank.length) return;
    if (byRank.length - start < n - indices.length) return; // 剪枝

    for (let i = start; i < byRank.length; i++) {
      indices.push(i);
      walk(i + 1);
      indices.pop();
    }
  }

  walk(0);
  return result;
}

/**
 * 从剩余中选 n 对（每对同rank）
 * 赖子可以和单牌配对，或两张赖子自成一对
 */
function choosePairKickers(
  naturals: Card[],
  wilds: Card[],
  pairCount: number,
): Card[][] {
  // 按 rank 统计剩余自然牌
  const grouped = new Map<Rank, Card[]>();
  for (const card of naturals) {
    const arr = grouped.get(card.rank) ?? [];
    arr.push(card);
    grouped.set(card.rank, arr);
  }

  // 可以形成的对子选项
  interface PairOption {
    cards: Card[];
    wildsUsed: number;
  }
  const pairOptions: PairOption[] = [];

  for (const [, cards] of grouped) {
    // 纯自然对子
    if (cards.length >= 2) {
      pairOptions.push({ cards: cards.slice(0, 2), wildsUsed: 0 });
    }
    // 自然单牌 + 赖子
    if (cards.length >= 1 && wilds.length > 0) {
      pairOptions.push({ cards: [cards[0]], wildsUsed: 1 });
    }
  }
  // 纯赖子对
  if (wilds.length >= 2) {
    pairOptions.push({ cards: [], wildsUsed: 2 });
  }

  // 从 pairOptions 中选 pairCount 对，赖子总用量 <= wilds.length
  const result: Card[][] = [];

  function walk(optIdx: number, remaining: number, wildsLeft: number, selected: PairOption[]) {
    if (remaining === 0) {
      // 构建结果
      const cards: Card[] = [];
      let wUsed = 0;
      for (const opt of selected) {
        cards.push(...opt.cards);
        for (let i = 0; i < opt.wildsUsed; i++) {
          cards.push(wilds[wUsed++]);
        }
      }
      result.push(cards);
      return;
    }
    if (optIdx >= pairOptions.length) return;

    // 不选当前
    walk(optIdx + 1, remaining, wildsLeft, selected);

    // 选当前
    const opt = pairOptions[optIdx];
    if (opt.wildsUsed <= wildsLeft) {
      selected.push(opt);
      walk(optIdx + 1, remaining - 1, wildsLeft - opt.wildsUsed, selected);
      selected.pop();
    }
  }

  walk(0, pairCount, wilds.length, []);
  return result;
}

export function getPlayableHints(
  hand: Card[],
  previousPlay: CardPlay | null,
  wildcardRank?: Rank | null,
): CardPlay[] {
  // 赖子模式
  if (wildcardRank != null) {
    return getPlayableHintsWild(hand, previousPlay, wildcardRank);
  }

  // 非赖子模式：原有逻辑
  const grouped = buildGroupedCards(hand);
  const counts = buildCountMap(grouped);
  const result: CardPlay[] = [];
  const seen = new Set<string>();
  const ranks = [...counts.keys()].sort((a, b) => a - b);

  for (const rank of ranks) {
    pushCandidate(result, seen, grouped, previousPlay, new Map([[rank, 1]]));
  }

  for (const rank of ranks.filter((entry) => (counts.get(entry) ?? 0) >= 2)) {
    pushCandidate(result, seen, grouped, previousPlay, new Map([[rank, 2]]));
  }

  for (const rank of ranks.filter((entry) => (counts.get(entry) ?? 0) >= 3)) {
    pushCandidate(result, seen, grouped, previousPlay, new Map([[rank, 3]]));
  }

  for (const rank of ranks.filter((entry) => (counts.get(entry) ?? 0) >= 4)) {
    pushCandidate(result, seen, grouped, previousPlay, new Map([[rank, 4]]));
  }

  if ((counts.get(Rank.BlackJoker) ?? 0) > 0 && (counts.get(Rank.RedJoker) ?? 0) > 0) {
    pushCandidate(
      result,
      seen,
      grouped,
      previousPlay,
      new Map([
        [Rank.BlackJoker, 1],
        [Rank.RedJoker, 1],
      ]),
    );
  }

  for (const rank of ranks.filter((entry) => (counts.get(entry) ?? 0) >= 3)) {
    const tripleSelection = new Map<Rank, number>([[rank, 3]]);

    for (const singles of chooseUnits(
      buildUnitOptions(subtractCounts(counts, tripleSelection), 1),
      1,
    )) {
      const selection = new Map(tripleSelection);
      addRanksToSelection(selection, singles, 1);
      pushCandidate(result, seen, grouped, previousPlay, selection);
    }

    for (const pairs of chooseUnits(
      buildUnitOptions(subtractCounts(counts, tripleSelection), 2),
      1,
    )) {
      const selection = new Map(tripleSelection);
      addRanksToSelection(selection, pairs, 2);
      pushCandidate(result, seen, grouped, previousPlay, selection);
    }
  }

  for (const run of findConsecutiveRuns(
    ranks.filter((entry) => (counts.get(entry) ?? 0) >= 1),
    MIN_STRAIGHT_LENGTH,
  )) {
    const selection = new Map<Rank, number>();
    addRanksToSelection(selection, run, 1);
    pushCandidate(result, seen, grouped, previousPlay, selection);
  }

  for (const run of findConsecutiveRuns(
    ranks.filter((entry) => (counts.get(entry) ?? 0) >= 2),
    MIN_DOUBLE_STRAIGHT_LENGTH,
  )) {
    const selection = new Map<Rank, number>();
    addRanksToSelection(selection, run, 2);
    pushCandidate(result, seen, grouped, previousPlay, selection);
  }

  for (const run of findConsecutiveRuns(
    ranks.filter((entry) => (counts.get(entry) ?? 0) >= 3),
    MIN_TRIPLE_STRAIGHT_LENGTH,
  )) {
    const tripleSelection = new Map<Rank, number>();
    addRanksToSelection(tripleSelection, run, 3);
    pushCandidate(result, seen, grouped, previousPlay, tripleSelection);

    for (const singles of chooseUnits(
      buildUnitOptions(subtractCounts(counts, tripleSelection), 1),
      run.length,
    )) {
      const selection = new Map(tripleSelection);
      addRanksToSelection(selection, singles, 1);
      pushCandidate(result, seen, grouped, previousPlay, selection);
    }

    for (const pairs of chooseUnits(
      buildUnitOptions(subtractCounts(counts, tripleSelection), 2),
      run.length,
    )) {
      const selection = new Map(tripleSelection);
      addRanksToSelection(selection, pairs, 2);
      pushCandidate(result, seen, grouped, previousPlay, selection);
    }
  }

  for (const rank of ranks.filter((entry) => (counts.get(entry) ?? 0) >= 4)) {
    const quadSelection = new Map<Rank, number>([[rank, 4]]);

    for (const singles of chooseUnits(
      buildUnitOptions(subtractCounts(counts, quadSelection), 1),
      2,
    )) {
      const selection = new Map(quadSelection);
      addRanksToSelection(selection, singles, 1);
      pushCandidate(result, seen, grouped, previousPlay, selection);
    }

    for (const pairs of chooseUnits(
      buildUnitOptions(subtractCounts(counts, quadSelection), 2),
      2,
    )) {
      const selection = new Map(quadSelection);
      addRanksToSelection(selection, pairs, 2);
      pushCandidate(result, seen, grouped, previousPlay, selection);
    }
  }

  return result.sort(comparePlays);
}
