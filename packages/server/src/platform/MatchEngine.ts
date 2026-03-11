import type { Card, GamePhase, GameSnapshot } from "@blitzlord/shared";
import type {
  MatchAction,
  MatchActionResult,
  MatchActionTarget,
  MatchEndResult,
} from "./actionHandlers.js";
import { dispatchMatchAction } from "./actionHandlers.js";

export interface MatchRuntime extends MatchActionTarget {
  roomId: string;
  gameId: string;
  modeId: string;
  phase: GamePhase;
  currentCallerId: string | null;
  currentTurn: string | null;
  getPlayerHand: (playerId: string) => Card[];
  getFullState: (playerId: string) => GameSnapshot;
  setPlayerOnline: (playerId: string, online: boolean) => void;
  handleDisconnectTimeout: (playerId: string) => MatchEndResult | null;
}

export class MatchEngine implements MatchActionTarget {
  constructor(private readonly runtime: MatchRuntime) {}

  get roomId(): string {
    return this.runtime.roomId;
  }

  get gameId(): string {
    return this.runtime.gameId;
  }

  get modeId(): string {
    return this.runtime.modeId;
  }

  get phase(): GamePhase {
    return this.runtime.phase;
  }

  get currentCallerId(): string | null {
    return this.runtime.currentCallerId;
  }

  get currentTurn(): string | null {
    return this.runtime.currentTurn;
  }

  getPlayerHand(playerId: string): Card[] {
    return this.runtime.getPlayerHand(playerId);
  }

  getFullState(playerId: string): GameSnapshot {
    return this.runtime.getFullState(playerId);
  }

  setPlayerOnline(playerId: string, online: boolean): void {
    this.runtime.setPlayerOnline(playerId, online);
  }

  handleDisconnectTimeout(playerId: string): MatchEndResult | null {
    return this.runtime.handleDisconnectTimeout(playerId);
  }

  callBid(playerId: string, bid: 0 | 1 | 2 | 3) {
    return this.runtime.callBid(playerId, bid);
  }

  playCards(playerId: string, cards: Card[]) {
    return this.runtime.playCards(playerId, cards);
  }

  pass(playerId: string) {
    return this.runtime.pass(playerId);
  }

  dispatch<T extends MatchAction>(action: T): MatchActionResult<T["type"]> {
    return dispatchMatchAction(this, action);
  }
}
