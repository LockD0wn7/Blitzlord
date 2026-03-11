import { describe, expect, it, vi } from "vitest";
import { Rank, Suit } from "@blitzlord/shared";
import { createServerGameRegistry } from "../platform/GameRegistry.js";
import { type MatchRuntime, MatchEngine } from "../platform/MatchEngine.js";
import { dispatchMatchAction } from "../platform/actionHandlers.js";
import type { MatchPlayer } from "../platform/types.js";

const PLAYERS: MatchPlayer[] = [
  { playerId: "p1", playerName: "Alice" },
  { playerId: "p2", playerName: "Bob" },
  { playerId: "p3", playerName: "Carol" },
];

function createSelection(modeId: "classic" | "wildcard" = "classic") {
  return {
    gameId: "doudizhu",
    gameName: "Doudizhu",
    modeId,
    modeName: modeId === "wildcard" ? "Wildcard" : "Classic",
    config: { wildcard: modeId === "wildcard" },
  };
}

describe("MatchEngine", () => {
  it("creates a classic doudizhu match from room selection", () => {
    const registry = createServerGameRegistry();
    const match = registry.createMatchEngine("room-1", PLAYERS, createSelection("classic"));

    expect(match.gameId).toBe("doudizhu");
    expect(match.modeId).toBe("classic");

    const caller = match.currentCallerId!;
    const result = match.dispatch({
      type: "callBid",
      playerId: caller,
      bid: 3,
    });

    expect(result.ok).toBe(true);
    expect(result.landlord?.wildcardRank).toBeNull();
    expect(match.getFullState(caller).gameId).toBe("doudizhu");
    expect(match.getFullState(caller).modeId).toBe("classic");
  });

  it("keeps classic mode behavior even if config conflicts with the mode defaults", () => {
    const registry = createServerGameRegistry();
    const match = registry.createMatchEngine("room-1", PLAYERS, {
      ...createSelection("classic"),
      config: { wildcard: true },
    });

    const caller = match.currentCallerId!;
    const result = match.dispatch({
      type: "callBid",
      playerId: caller,
      bid: 3,
    });

    expect(result.ok).toBe(true);
    expect(result.landlord?.wildcardRank).toBeNull();
  });

  it("creates a wildcard doudizhu match from room selection", () => {
    const registry = createServerGameRegistry();
    const match = registry.createMatchEngine("room-1", PLAYERS, createSelection("wildcard"));

    expect(match.modeId).toBe("wildcard");

    const caller = match.currentCallerId!;
    const result = match.dispatch({
      type: "callBid",
      playerId: caller,
      bid: 3,
    });

    expect(result.ok).toBe(true);
    expect(result.landlord?.wildcardRank).not.toBeNull();
    expect(match.getFullState(caller).modeId).toBe("wildcard");
  });

  it("dispatches actions to the runtime handler", () => {
    const runtime = {
      roomId: "room-1",
      gameId: "stub",
      modeId: "mode-a",
      phase: "calling",
      currentCallerId: "p1",
      currentTurn: null,
      getPlayerHand: vi.fn(() => []),
      getFullState: vi.fn(() => ({
        roomId: "room-1",
        gameId: "stub",
        modeId: "mode-a",
        phase: "calling",
        myHand: [],
        myRole: null,
        currentTurn: null,
        lastPlay: null,
        consecutivePasses: 0,
        bottomCards: [],
        baseBid: 0,
        bombCount: 0,
        rocketUsed: false,
        players: [],
        callSequence: [],
        tracker: { history: [], remainingByRank: [] },
      })),
      setPlayerOnline: vi.fn(),
      handleDisconnectTimeout: vi.fn(() => null),
      callBid: vi.fn(() => ({ ok: true, nextCaller: "p2", landlord: null })),
      playCards: vi.fn(() => ({ ok: true, remainingCards: 16, gameEnd: null })),
      pass: vi.fn(() => ({ ok: true, nextTurn: "p3", resetRound: false })),
    } as unknown as MatchRuntime;

    const engine = new MatchEngine(runtime);

    dispatchMatchAction(engine, {
      type: "callBid",
      playerId: "p1",
      bid: 1,
    });
    expect(runtime.callBid).toHaveBeenCalledWith("p1", 1);

    dispatchMatchAction(engine, {
      type: "playCards",
      playerId: "p1",
      cards: [{ rank: Rank.Ace, suit: Suit.Spade }],
    });
    expect(runtime.playCards).toHaveBeenCalledWith("p1", [{ rank: Rank.Ace, suit: Suit.Spade }]);

    dispatchMatchAction(engine, {
      type: "pass",
      playerId: "p2",
    });
    expect(runtime.pass).toHaveBeenCalledWith("p2");
  });
});
