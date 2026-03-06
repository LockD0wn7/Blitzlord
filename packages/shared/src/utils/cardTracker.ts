import { Rank } from "../types/card.js";
import type { Card } from "../types/card.js";
import type {
  CardTrackerSnapshot,
  TrackerHistoryEntry,
  TrackerRankStat,
} from "../types/game.js";

const TRACKER_RANK_ORDER: Rank[] = [
  Rank.RedJoker,
  Rank.BlackJoker,
  Rank.Two,
  Rank.Ace,
  Rank.King,
  Rank.Queen,
  Rank.Jack,
  Rank.Ten,
  Rank.Nine,
  Rank.Eight,
  Rank.Seven,
  Rank.Six,
  Rank.Five,
  Rank.Four,
  Rank.Three,
];

function getTotalCopies(rank: Rank): number {
  if (rank === Rank.RedJoker || rank === Rank.BlackJoker) {
    return 1;
  }
  return 4;
}

function countByRank(cards: Card[]): Map<Rank, number> {
  const counts = new Map<Rank, number>();
  for (const card of cards) {
    counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
  }
  return counts;
}

function cloneHistory(history: TrackerHistoryEntry[]): TrackerHistoryEntry[] {
  return history.map((entry) => ({
    ...entry,
    cards: [...entry.cards],
  }));
}

export function buildCardTrackerSnapshot(params: {
  myHand: Card[];
  history: TrackerHistoryEntry[];
}): CardTrackerSnapshot {
  const handCounts = countByRank(params.myHand);
  const playedCounts = countByRank(
    params.history.flatMap((entry) => {
      if (entry.action === "pass") {
        return [];
      }
      return entry.cards;
    }),
  );

  const remainingByRank: TrackerRankStat[] = TRACKER_RANK_ORDER.map((rank) => {
    const totalCopies = getTotalCopies(rank);
    const playedCopies = playedCounts.get(rank) ?? 0;
    const myCopies = handCounts.get(rank) ?? 0;

    return {
      rank,
      totalCopies,
      playedCopies,
      myCopies,
      remainingOpponentCopies: Math.max(0, totalCopies - playedCopies - myCopies),
    };
  });

  return {
    history: cloneHistory(params.history),
    remainingByRank,
  };
}
