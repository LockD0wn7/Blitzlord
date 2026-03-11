import { WILDCARD_SEQUENCE_RANKS } from "../constants/card.js";
import { CardType, Rank, type Card, type CardPlay } from "../types/card.js";
import { identifyCardType } from "./cardType.js";

export type DisplayCard = Card & {
  isWildcard?: boolean;
};

function cloneCards(
  cards: Array<Card | DisplayCard>,
  wildcardRank?: Rank | null,
): DisplayCard[] {
  return cards.map((card) => ({
    ...card,
    isWildcard:
      "isWildcard" in card
        ? card.isWildcard
        : wildcardRank != null && card.rank === wildcardRank
        ? true
        : undefined,
  }));
}

function countRanks(cards: Card[]): Map<Rank, number> {
  const counts = new Map<Rank, number>();
  for (const card of cards) {
    counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
  }
  return counts;
}

function sumCounts(counts: Map<Rank, number>): number {
  let total = 0;
  for (const count of counts.values()) {
    total += count;
  }
  return total;
}

function subtractRankCount(
  counts: Map<Rank, number>,
  rank: Rank,
  count: number,
): Map<Rank, number> | null {
  const remaining = new Map(counts);
  const current = remaining.get(rank) ?? 0;
  if (current < count) {
    return null;
  }

  if (current === count) {
    remaining.delete(rank);
  } else {
    remaining.set(rank, current - count);
  }

  return remaining;
}

function subtractRunCounts(
  counts: Map<Rank, number>,
  startRank: Rank,
  length: number,
  perRank: number,
): Map<Rank, number> | null {
  const startIndex = WILDCARD_SEQUENCE_RANKS.indexOf(startRank);
  if (startIndex === -1 || startIndex + length > WILDCARD_SEQUENCE_RANKS.length) {
    return null;
  }

  let remaining = new Map(counts);
  for (let offset = 0; offset < length; offset++) {
    const rank = WILDCARD_SEQUENCE_RANKS[startIndex + offset];
    const next = subtractRankCount(remaining, rank, perRank);
    if (next === null) {
      return null;
    }
    remaining = next;
  }

  return remaining;
}

function canFormExactPairs(counts: Map<Rank, number>, targetPairs: number): boolean {
  if (sumCounts(counts) !== targetPairs * 2) {
    return false;
  }

  let pairs = 0;
  for (const count of counts.values()) {
    pairs += Math.floor(count / 2);
  }

  return pairs >= targetPairs;
}

function matchesPlayShape(cards: Card[], play: CardPlay): boolean {
  const counts = countRanks(cards);

  switch (play.type) {
    case CardType.Single:
      return cards.length === 1 && cards[0]?.rank === play.mainRank;

    case CardType.Pair:
      return cards.length === 2 && (counts.get(play.mainRank) ?? 0) === 2;

    case CardType.Triple:
      return cards.length === 3 && (counts.get(play.mainRank) ?? 0) === 3;

    case CardType.TripleWithOne: {
      const remaining = subtractRankCount(counts, play.mainRank, 3);
      return cards.length === 4 && remaining !== null && sumCounts(remaining) === 1;
    }

    case CardType.TripleWithPair: {
      const remaining = subtractRankCount(counts, play.mainRank, 3);
      return cards.length === 5 && remaining !== null && canFormExactPairs(remaining, 1);
    }

    case CardType.Bomb:
      return cards.length === 4 && (counts.get(play.mainRank) ?? 0) === 4;

    case CardType.Rocket:
      return (
        cards.length === 2 &&
        cards.some((card) => card.rank === Rank.BlackJoker) &&
        cards.some((card) => card.rank === Rank.RedJoker)
      );

    case CardType.QuadWithTwo: {
      const remaining = subtractRankCount(counts, play.mainRank, 4);
      return cards.length === 6 && remaining !== null && sumCounts(remaining) === 2;
    }

    case CardType.QuadWithTwoPairs: {
      const remaining = subtractRankCount(counts, play.mainRank, 4);
      return cards.length === 8 && remaining !== null && canFormExactPairs(remaining, 2);
    }

    case CardType.Straight: {
      if (play.length == null) return false;
      const remaining = subtractRunCounts(counts, play.mainRank, play.length, 1);
      return remaining !== null && sumCounts(remaining) === 0;
    }

    case CardType.DoubleStraight: {
      if (play.length == null) return false;
      const remaining = subtractRunCounts(counts, play.mainRank, play.length, 2);
      return remaining !== null && sumCounts(remaining) === 0;
    }

    case CardType.TripleStraight: {
      if (play.length == null) return false;
      const remaining = subtractRunCounts(counts, play.mainRank, play.length, 3);
      return remaining !== null && sumCounts(remaining) === 0;
    }

    case CardType.TripleStraightWithOnes: {
      if (play.length == null) return false;
      const remaining = subtractRunCounts(counts, play.mainRank, play.length, 3);
      return remaining !== null && sumCounts(remaining) === play.length;
    }

    case CardType.TripleStraightWithPairs: {
      if (play.length == null) return false;
      const remaining = subtractRunCounts(counts, play.mainRank, play.length, 3);
      return remaining !== null && canFormExactPairs(remaining, play.length);
    }
  }

  return false;
}

function getRelevantRanks(play: CardPlay, wildcardRank: Rank): Rank[] {
  const ordered: Rank[] = [];
  const seen = new Set<Rank>();

  const push = (rank: Rank | undefined) => {
    if (rank === undefined || seen.has(rank)) {
      return;
    }
    seen.add(rank);
    ordered.push(rank);
  };

  if (
    play.length != null &&
    (
      play.type === CardType.Straight ||
      play.type === CardType.DoubleStraight ||
      play.type === CardType.TripleStraight ||
      play.type === CardType.TripleStraightWithOnes ||
      play.type === CardType.TripleStraightWithPairs
    )
  ) {
    const startIndex = WILDCARD_SEQUENCE_RANKS.indexOf(play.mainRank);
    if (startIndex !== -1) {
      for (let offset = 0; offset < play.length; offset++) {
        push(WILDCARD_SEQUENCE_RANKS[startIndex + offset]);
      }
    }
  } else {
    push(play.mainRank);
  }

  push(wildcardRank);

  for (const card of play.cards) {
    push(card.rank);
  }

  return ordered;
}

function orderDisplayCards(cards: DisplayCard[], play: CardPlay): DisplayCard[] {
  if (
    play.length == null ||
    !(
      play.type === CardType.Straight ||
      play.type === CardType.DoubleStraight ||
      play.type === CardType.TripleStraight ||
      play.type === CardType.TripleStraightWithOnes ||
      play.type === CardType.TripleStraightWithPairs
    )
  ) {
    return cards;
  }

  const startIndex = WILDCARD_SEQUENCE_RANKS.indexOf(play.mainRank);
  if (startIndex === -1) {
    return cards;
  }

  const order = new Map<Rank, number>();
  for (let offset = 0; offset < play.length; offset++) {
    order.set(WILDCARD_SEQUENCE_RANKS[startIndex + offset], offset);
  }

  return [...cards].sort((left, right) => {
    const leftOrder = order.get(left.rank) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = order.get(right.rank) ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder;
  });
}

export function getDisplayCardsForPlay(
  play: CardPlay,
  wildcardRank?: Rank | null,
): DisplayCard[] {
  if (
    wildcardRank == null ||
    !play.cards.some((card) => card.rank === wildcardRank)
  ) {
    return cloneCards(play.cards, wildcardRank);
  }

  const wildcardIndexes = play.cards.flatMap((card, index) =>
    card.rank === wildcardRank ? [index] : [],
  );
  if (wildcardIndexes.length === 0) {
    return cloneCards(play.cards, wildcardRank);
  }

  const candidate = cloneCards(play.cards, wildcardRank);
  const ranksToTry = getRelevantRanks(play, wildcardRank);
  let bestCards: DisplayCard[] | null = null;
  let bestCost = Infinity;

  const search = (cursor: number, changedCount: number) => {
    if (changedCount > bestCost) {
      return;
    }

    if (cursor >= wildcardIndexes.length) {
      if (matchesPlayShape(candidate, play)) {
        bestCost = changedCount;
        bestCards = cloneCards(candidate);
      }
      return;
    }

    const targetIndex = wildcardIndexes[cursor];
    const sourceCard = play.cards[targetIndex];

    for (const rank of ranksToTry) {
      candidate[targetIndex] = {
        suit: sourceCard.suit,
        rank,
        isWildcard: true,
      };
      search(cursor + 1, changedCount + (rank === wildcardRank ? 0 : 1));
    }
  };

  search(0, 0);
  return orderDisplayCards(bestCards ?? cloneCards(play.cards, wildcardRank), play);
}

export function getDisplayCardsForCards(
  cards: Card[],
  wildcardRank?: Rank | null,
): DisplayCard[] {
  if (
    wildcardRank == null ||
    !cards.some((card) => card.rank === wildcardRank)
  ) {
    return cloneCards(cards, wildcardRank);
  }

  const play = identifyCardType(cards, wildcardRank);
  if (play === null) {
    return cloneCards(cards, wildcardRank);
  }

  return getDisplayCardsForPlay(play, wildcardRank);
}
