import {
  buildCardTrackerSnapshot,
  cardEquals,
  sortCards,
} from "@blitzlord/shared";
import type {
  Card,
  CardPlay,
  CardTrackerSnapshot,
  GameSnapshot,
  TrackerHistoryEntry,
} from "@blitzlord/shared";

function getNextTrackerSequence(snapshot: CardTrackerSnapshot): number {
  return (snapshot.history.at(-1)?.sequence ?? 0) + 1;
}

function getCurrentTrackerRound(snapshot: CardTrackerSnapshot): number {
  return snapshot.history.at(-1)?.round ?? 1;
}

function getNextPlayTrackerRound(
  snapshot: CardTrackerSnapshot,
  lastPlay: GameSnapshot["lastPlay"],
): number {
  if (snapshot.history.length === 0) {
    return 1;
  }

  if (lastPlay === null) {
    return getCurrentTrackerRound(snapshot) + 1;
  }

  return getCurrentTrackerRound(snapshot);
}

function removePlayedCardsFromHand(hand: Card[], cards: Card[]): Card[] {
  return hand.filter(
    (handCard) => !cards.some((card) => cardEquals(card, handCard)),
  );
}

export function buildTrackerStateForGameStart(hand: Card[]): CardTrackerSnapshot {
  return buildCardTrackerSnapshot({
    myHand: sortCards(hand),
    history: [],
  });
}

export function buildTrackerStateForLandlordDecision(params: {
  token: string;
  landlordId: string;
  myHand: Card[];
  bottomCards: Card[];
  history: TrackerHistoryEntry[];
}): {
  nextHand: Card[];
  tracker: CardTrackerSnapshot;
} {
  const nextHand =
    params.landlordId === params.token
      ? sortCards([...params.myHand, ...params.bottomCards])
      : params.myHand;

  return {
    nextHand,
    tracker: buildCardTrackerSnapshot({
      myHand: nextHand,
      history: params.history,
    }),
  };
}

export function buildTrackerPlayUpdate(params: {
  token: string;
  playerId: string;
  myHand: Card[];
  tracker: CardTrackerSnapshot;
  lastPlay: GameSnapshot["lastPlay"];
  play: CardPlay;
}): {
  nextHand: Card[];
  entry: TrackerHistoryEntry;
  tracker: CardTrackerSnapshot;
} {
  const nextHand =
    params.playerId === params.token
      ? removePlayedCardsFromHand(params.myHand, params.play.cards)
      : params.myHand;
  const entry: TrackerHistoryEntry = {
    sequence: getNextTrackerSequence(params.tracker),
    round: getNextPlayTrackerRound(params.tracker, params.lastPlay),
    playerId: params.playerId,
    action: "play",
    cards: params.play.cards.map((card) => ({ ...card })),
  };

  return {
    nextHand,
    entry,
    tracker: buildCardTrackerSnapshot({
      myHand: nextHand,
      history: [...params.tracker.history, entry],
    }),
  };
}

export function buildTrackerPassEntry(params: {
  tracker: CardTrackerSnapshot;
  playerId: string;
}): {
  entry: TrackerHistoryEntry;
  remainingByRank: CardTrackerSnapshot["remainingByRank"];
} {
  return {
    entry: {
      sequence: getNextTrackerSequence(params.tracker),
      round: getCurrentTrackerRound(params.tracker),
      playerId: params.playerId,
      action: "pass",
      cards: [],
    },
    remainingByRank: params.tracker.remainingByRank,
  };
}
