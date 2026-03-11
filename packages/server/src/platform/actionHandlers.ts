import type {
  Card,
  CardPlay,
  PlayerRole,
  Rank,
  ScoreDetail,
} from "@blitzlord/shared";

export interface MatchEndResult {
  winnerId: string;
  winnerRole: PlayerRole;
  scores: Record<string, ScoreDetail>;
}

export interface MatchActionTarget {
  callBid: (
    playerId: string,
    bid: 0 | 1 | 2 | 3,
  ) => {
    ok: boolean;
    error?: string;
    nextCaller?: string | null;
    landlord?: {
      playerId: string;
      bottomCards: Card[];
      baseBid: 1 | 2 | 3;
      wildcardRank: Rank | null;
    } | null;
    redeal?: boolean;
  };
  playCards: (
    playerId: string,
    cards: Card[],
  ) => {
    ok: boolean;
    error?: string;
    play?: CardPlay;
    remainingCards?: number;
    gameEnd?: MatchEndResult | null;
  };
  pass: (
    playerId: string,
  ) => {
    ok: boolean;
    error?: string;
    nextTurn?: string;
    resetRound?: boolean;
  };
}

export type CallBidAction = { type: "callBid"; playerId: string; bid: 0 | 1 | 2 | 3 };
export type PlayCardsAction = { type: "playCards"; playerId: string; cards: Card[] };
export type PassAction = { type: "pass"; playerId: string };

export type MatchAction = CallBidAction | PlayCardsAction | PassAction;

export interface MatchActionResultMap {
  callBid: ReturnType<MatchActionTarget["callBid"]>;
  playCards: ReturnType<MatchActionTarget["playCards"]>;
  pass: ReturnType<MatchActionTarget["pass"]>;
}

export type MatchActionResult<T extends MatchAction["type"] = MatchAction["type"]> = MatchActionResultMap[T];

export function dispatchMatchAction<T extends MatchAction>(
  target: MatchActionTarget,
  action: T,
): MatchActionResult<T["type"]> {
  switch (action.type) {
    case "callBid":
      return target.callBid(action.playerId, action.bid) as MatchActionResult<T["type"]>;
    case "playCards":
      return target.playCards(action.playerId, action.cards) as MatchActionResult<T["type"]>;
    case "pass":
      return target.pass(action.playerId) as MatchActionResult<T["type"]>;
  }
}
