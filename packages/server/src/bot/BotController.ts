import { GamePhase, type GameSnapshot } from "@blitzlord/shared";
import {
  getPlayableHints,
  isDoudizhuSnapshot,
} from "@blitzlord/shared/games/doudizhu";
import type { MatchAction } from "../platform/actionHandlers.js";
import type { MatchEngine } from "../platform/MatchEngine.js";
import { RoomManager } from "../room/RoomManager.js";

const BOT_DELAY_MIN_MS = 600;
const BOT_DELAY_MAX_MS = 1200;

type BotAction =
  | Omit<Extract<MatchAction, { type: "callBid" }>, "playerId">
  | Omit<Extract<MatchAction, { type: "playCards" }>, "playerId">
  | Omit<Extract<MatchAction, { type: "pass" }>, "playerId">;

export interface BotControllerDeps {
  roomManager: RoomManager;
  matches: Map<string, MatchEngine>;
  dispatchAction: (roomId: string, action: MatchAction) => { ok: boolean; error?: string };
}

export class BotController {
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly deps: BotControllerDeps) {}

  cancel(roomId: string): void {
    const timer = this.timers.get(roomId);
    if (!timer) {
      return;
    }

    clearTimeout(timer);
    this.timers.delete(roomId);
  }

  scheduleIfNeeded(roomId: string): void {
    this.cancel(roomId);

    const room = this.deps.roomManager.getRoom(roomId);
    const game = this.deps.matches.get(roomId);
    if (!room || !game) {
      return;
    }

    const botPlayerId = this.getCurrentBotPlayerId(roomId, game);
    if (!botPlayerId) {
      return;
    }

    const delay = BOT_DELAY_MIN_MS + Math.floor(Math.random() * (BOT_DELAY_MAX_MS - BOT_DELAY_MIN_MS + 1));
    const timer = setTimeout(() => {
      this.timers.delete(roomId);
      this.takeTurn(roomId, botPlayerId);
    }, delay);
    this.timers.set(roomId, timer);
  }

  private takeTurn(roomId: string, playerId: string): void {
    const game = this.deps.matches.get(roomId);
    if (!game || this.getCurrentBotPlayerId(roomId, game) !== playerId) {
      return;
    }

    const snapshot = game.getFullState(playerId);
    const actionData = this.pickAction(snapshot);
    if (!actionData) {
      return;
    }

    let result = this.deps.dispatchAction(roomId, this.withPlayerId(playerId, actionData));

    if (!result.ok) {
      const fallbackAction = this.pickFallbackAction(snapshot);
      if (!fallbackAction) {
        return;
      }

      result = this.deps.dispatchAction(roomId, this.withPlayerId(playerId, fallbackAction));
      if (!result.ok) {
        return;
      }
    }

    this.scheduleIfNeeded(roomId);
  }

  private withPlayerId(playerId: string, action: BotAction): MatchAction {
    switch (action.type) {
      case "callBid":
        return {
          type: "callBid",
          playerId,
          bid: action.bid,
        };
      case "playCards":
        return {
          type: "playCards",
          playerId,
          cards: action.cards,
        };
      case "pass":
        return {
          type: "pass",
          playerId,
        };
    }
  }

  private getCurrentBotPlayerId(roomId: string, game: MatchEngine): string | null {
    const room = this.deps.roomManager.getRoom(roomId);
    if (!room) {
      return null;
    }

    const currentPlayerId = game.phase === GamePhase.Calling
      ? game.currentCallerId
      : game.currentTurn;
    if (!currentPlayerId) {
      return null;
    }

    const player = room.getPlayer(currentPlayerId);
    if (!player || player.playerType !== "bot") {
      return null;
    }

    return currentPlayerId;
  }

  private pickAction(snapshot: GameSnapshot): BotAction | null {
    if (snapshot.phase === GamePhase.Calling) {
      const highestBid = snapshot.callSequence.reduce<0 | 1 | 2 | 3>(
        (highest, entry) => (entry.bid > highest ? entry.bid : highest),
        0,
      );
      const legalBids = ([0, 1, 2, 3] as const).filter(
        (bid) => bid === 0 || bid > highestBid,
      );
      const bid = legalBids[Math.floor(Math.random() * legalBids.length)] ?? 0;
      return { type: "callBid", bid };
    }

    if (snapshot.phase !== GamePhase.Playing || !isDoudizhuSnapshot(snapshot)) {
      return null;
    }

    const hints = getPlayableHints(
      snapshot.myHand,
      snapshot.lastPlay?.play ?? null,
      snapshot.wildcardRank,
    );
    if (hints.length === 0) {
      return { type: "pass" };
    }

    const chosenHint = hints[Math.floor(Math.random() * hints.length)] ?? hints[0];
    return {
      type: "playCards",
      cards: chosenHint.cards,
    };
  }

  private pickFallbackAction(snapshot: GameSnapshot): BotAction | null {
    if (snapshot.phase === GamePhase.Calling) {
      return { type: "callBid", bid: 0 };
    }

    if (snapshot.phase !== GamePhase.Playing || !isDoudizhuSnapshot(snapshot)) {
      return null;
    }

    if (snapshot.lastPlay) {
      return { type: "pass" };
    }

    const hints = getPlayableHints(snapshot.myHand, null, snapshot.wildcardRank);
    const firstHint = hints[0];
    if (!firstHint) {
      return null;
    }

    return {
      type: "playCards",
      cards: firstHint.cards,
    };
  }
}