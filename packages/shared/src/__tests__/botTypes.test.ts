import { describe, expect, expectTypeOf, it } from "vitest";
import type { ClientEvents, GameSnapshot, RoomPlayer } from "../types/index.js";

describe("bot-related shared types", () => {
  it("exposes playerType on room players", () => {
    const roomPlayer: RoomPlayer = {
      playerId: "bot:r1:1",
      playerName: "机器人 1",
      playerType: "bot",
      isReady: true,
      isOnline: true,
      seatIndex: 1,
    };

    expect(roomPlayer.playerType).toBe("bot");
  });

  it("exposes playerType on game snapshot players", () => {
    const snapshotPlayer: GameSnapshot["players"][number] = {
      playerId: "bot:r1:1",
      playerName: "机器人 1",
      playerType: "bot",
      role: null,
      cardCount: 17,
      isOnline: true,
    };

    expect(snapshotPlayer.playerType).toBe("bot");
  });

  it("declares bot room events", () => {
    const addBot: ClientEvents["room:addBot"] = (callback) => {
      callback({ ok: true, playerId: "bot:r1:1" });
    };
    const removeBot: ClientEvents["room:removeBot"] = (data, callback) => {
      expect(data.playerId).toBe("bot:r1:1");
      callback({ ok: true });
    };

    expectTypeOf(addBot).toMatchTypeOf<ClientEvents["room:addBot"]>();
    expectTypeOf(removeBot).toMatchTypeOf<ClientEvents["room:removeBot"]>();
  });
});