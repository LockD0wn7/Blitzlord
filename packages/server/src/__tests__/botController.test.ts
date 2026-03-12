import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CardType,
  GamePhase,
  Rank,
  Suit,
  type GameSnapshot,
} from "@blitzlord/shared";
import type { MatchAction } from "../platform/actionHandlers.js";
import type { MatchEngine } from "../platform/MatchEngine.js";
import { RoomManager } from "../room/RoomManager.js";
import type { RoomGameSelection } from "../room/Room.js";
import { BotController } from "../bot/BotController.js";

function createSelection(): RoomGameSelection {
  return {
    gameId: "doudizhu",
    gameName: "Doudizhu",
    modeId: "classic",
    modeName: "Classic",
    config: { wildcard: false },
  };
}

function createSnapshot(overrides: Partial<GameSnapshot & { wildcardRank: Rank | null }> = {}): GameSnapshot & { wildcardRank: Rank | null } {
  return {
    roomId: "room-1",
    gameId: "doudizhu",
    modeId: "classic",
    phase: GamePhase.Calling,
    myHand: [],
    myRole: null,
    currentTurn: "bot:room-1:1",
    lastPlay: null,
    consecutivePasses: 0,
    bottomCards: [],
    baseBid: 0,
    bombCount: 0,
    rocketUsed: false,
    players: [
      {
        playerId: "host-1",
        playerName: "Alice",
        playerType: "human",
        role: null,
        cardCount: 17,
        isOnline: true,
      },
      {
        playerId: "bot:room-1:1",
        playerName: "Bot 1",
        playerType: "bot",
        role: null,
        cardCount: 17,
        isOnline: true,
      },
    ],
    callSequence: [],
    tracker: { history: [], remainingByRank: [] },
    wildcardRank: null,
    ...overrides,
  };
}

function createMatchStub(snapshot: GameSnapshot & { wildcardRank: Rank | null }): MatchEngine {
  return {
    phase: snapshot.phase,
    currentCallerId: snapshot.phase === GamePhase.Calling ? snapshot.currentTurn : null,
    currentTurn: snapshot.currentTurn,
    getFullState: vi.fn(() => snapshot),
  } as unknown as MatchEngine;
}

describe("BotController", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("dispatches a legal bid when the current caller is a bot", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.6);

    const roomManager = new RoomManager();
    const room = roomManager.createRoom("Bot Room", "host-1", "Alice", createSelection());
    roomManager.addBot(room.roomId, "bot:room-1:1", "Bot 1");

    const snapshot = createSnapshot({
      phase: GamePhase.Calling,
      currentTurn: "bot:room-1:1",
      callSequence: [{ playerId: "host-1", bid: 1 }],
    });
    const dispatchAction = vi.fn<(roomId: string, action: MatchAction) => { ok: boolean }>(() => ({ ok: true }));
    const matches = new Map<string, MatchEngine>([[room.roomId, createMatchStub(snapshot)]]);
    const controller = new BotController({ roomManager, matches, dispatchAction });

    controller.scheduleIfNeeded(room.roomId);
    vi.runOnlyPendingTimers();

    expect(dispatchAction).toHaveBeenCalledWith(room.roomId, {
      type: "callBid",
      playerId: "bot:room-1:1",
      bid: 2,
    });
  });

  it("plays a legal hint when the bot can act in the playing phase", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);

    const roomManager = new RoomManager();
    const room = roomManager.createRoom("Bot Room", "host-1", "Alice", createSelection());
    roomManager.addBot(room.roomId, "bot:room-1:1", "Bot 1");

    const snapshot = createSnapshot({
      phase: GamePhase.Playing,
      currentTurn: "bot:room-1:1",
      myHand: [{ rank: Rank.Three, suit: Suit.Spade }],
      callSequence: [{ playerId: "bot:room-1:1", bid: 1 }],
    });
    const dispatchAction = vi.fn<(roomId: string, action: MatchAction) => { ok: boolean }>(() => ({ ok: true }));
    const matches = new Map<string, MatchEngine>([[room.roomId, createMatchStub(snapshot)]]);
    const controller = new BotController({ roomManager, matches, dispatchAction });

    controller.scheduleIfNeeded(room.roomId);
    vi.runOnlyPendingTimers();

    expect(dispatchAction).toHaveBeenCalledWith(room.roomId, {
      type: "playCards",
      playerId: "bot:room-1:1",
      cards: [{ rank: Rank.Three, suit: Suit.Spade }],
    });
  });

  it("passes when the bot has no legal play", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);

    const roomManager = new RoomManager();
    const room = roomManager.createRoom("Bot Room", "host-1", "Alice", createSelection());
    roomManager.addBot(room.roomId, "bot:room-1:1", "Bot 1");

    const snapshot = createSnapshot({
      phase: GamePhase.Playing,
      currentTurn: "bot:room-1:1",
      myHand: [{ rank: Rank.Three, suit: Suit.Spade }],
      lastPlay: {
        playerId: "host-1",
        play: {
          type: CardType.Single,
          cards: [{ rank: Rank.RedJoker, suit: null }],
          mainRank: Rank.RedJoker,
        },
      },
    });
    const dispatchAction = vi.fn<(roomId: string, action: MatchAction) => { ok: boolean }>(() => ({ ok: true }));
    const matches = new Map<string, MatchEngine>([[room.roomId, createMatchStub(snapshot)]]);
    const controller = new BotController({ roomManager, matches, dispatchAction });

    controller.scheduleIfNeeded(room.roomId);
    vi.runOnlyPendingTimers();

    expect(dispatchAction).toHaveBeenCalledWith(room.roomId, {
      type: "pass",
      playerId: "bot:room-1:1",
    });
  });
});