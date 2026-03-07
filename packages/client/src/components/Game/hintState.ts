import type { Card, CardPlay } from "@blitzlord/shared";

interface BuildHintContextKeyParams {
  myHand: Card[];
  previousPlay: CardPlay | null;
  currentTurn: string | null;
}

interface GetNextHintSelectionParams {
  hints: CardPlay[];
  contextKey: string;
  hintContextKey: string | null;
  hintCursor: number;
}

interface HintSelection {
  cards: Card[];
  contextKey: string;
  nextCursor: number;
}

function serializeCards(cards: Card[]): string {
  return cards
    .map((card) => `${card.rank}:${card.suit ?? "joker"}`)
    .join("|");
}

export function buildHintContextKey(
  params: BuildHintContextKeyParams,
): string {
  const previousPlay = params.previousPlay
    ? [
        params.previousPlay.type,
        params.previousPlay.mainRank,
        params.previousPlay.length ?? 0,
        serializeCards(params.previousPlay.cards),
      ].join("/")
    : "free";

  return [
    params.currentTurn ?? "none",
    serializeCards(params.myHand),
    previousPlay,
  ].join("::");
}

export function getNextHintSelection(
  params: GetNextHintSelectionParams,
): HintSelection | null {
  if (params.hints.length === 0) {
    return null;
  }

  const currentIndex =
    params.hintContextKey === params.contextKey ? params.hintCursor : 0;
  const nextPlay = params.hints[currentIndex % params.hints.length];

  return {
    cards: nextPlay.cards,
    contextKey: params.contextKey,
    nextCursor: (currentIndex + 1) % params.hints.length,
  };
}
