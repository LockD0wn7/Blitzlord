import { getPlayableHints, type Card, type CardPlay } from "@blitzlord/shared";
import { buildHintContextKey, getNextHintSelection } from "./hintState";

interface ResolveHintActionParams {
  isMyTurn: boolean;
  token: string;
  myHand: Card[];
  currentTurn: string | null;
  lastPlay: { playerId: string; play: CardPlay } | null;
  hintContextKey: string | null;
  hintCursor: number;
}

type HintActionResult =
  | { type: "noop" }
  | { type: "error"; message: string }
  | {
      type: "selection";
      cards: Card[];
      contextKey: string;
      nextCursor: number;
    };

export function resolveHintAction(
  params: ResolveHintActionParams,
): HintActionResult {
  if (!params.isMyTurn) {
    return { type: "noop" };
  }

  const previousPlay =
    params.lastPlay && params.lastPlay.playerId !== params.token
      ? params.lastPlay.play
      : null;
  const hints = getPlayableHints(params.myHand, previousPlay);
  const contextKey = buildHintContextKey({
    myHand: params.myHand,
    previousPlay,
    currentTurn: params.currentTurn,
  });
  const nextSelection = getNextHintSelection({
    hints,
    contextKey,
    hintContextKey: params.hintContextKey,
    hintCursor: params.hintCursor,
  });

  if (!nextSelection) {
    return {
      type: "error",
      message: "没有可出的牌，请选择不出",
    };
  }

  return {
    type: "selection",
    cards: nextSelection.cards,
    contextKey: nextSelection.contextKey,
    nextCursor: nextSelection.nextCursor,
  };
}
