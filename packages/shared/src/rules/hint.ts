import {
  MIN_DOUBLE_STRAIGHT_LENGTH,
  MIN_STRAIGHT_LENGTH,
  MIN_TRIPLE_STRAIGHT_LENGTH,
  SEQUENCE_RANKS,
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

export function getPlayableHints(
  hand: Card[],
  previousPlay: CardPlay | null,
): CardPlay[] {
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
