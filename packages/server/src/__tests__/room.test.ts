import { beforeEach, describe, expect, it } from "vitest";
import { Room } from "../room/Room.js";
import { RoomManager } from "../room/RoomManager.js";

function createSelection(overrides: Partial<{
  gameId: string;
  gameName: string;
  modeId: string;
  modeName: string;
  config: Record<string, unknown>;
}> = {}) {
  const modeId = overrides.modeId ?? "classic";
  return {
    gameId: overrides.gameId ?? "doudizhu",
    gameName: overrides.gameName ?? "Doudizhu",
    modeId,
    modeName: overrides.modeName ?? (modeId === "wildcard" ? "Wildcard" : "Classic"),
    config: overrides.config ?? { wildcard: modeId === "wildcard" },
  };
}

describe("Room", () => {
  let room: Room;

  beforeEach(() => {
    room = new Room("room-1", "Test Room", createSelection());
  });

  it("starts in waiting status", () => {
    expect(room.status).toBe("waiting");
    expect(room.playerCount).toBe(0);
    expect(room.isFull).toBe(false);
  });

  describe("addPlayer / removePlayer", () => {
    it("adds a player and assigns the first seat", () => {
      const seat = room.addPlayer("p1", "Alice");
      expect(seat).toBe(0);
      expect(room.playerCount).toBe(1);
    });

    it("adds a bot as ready by default", () => {
      const seat = room.addPlayer("bot-1", "Bot 1", "bot");

      expect(seat).toBe(0);
      expect(room.getPlayer("bot-1")).toMatchObject({
        playerId: "bot-1",
        playerName: "Bot 1",
        playerType: "bot",
        isReady: true,
      });
    });

    it("does not allow a fourth player", () => {
      room.addPlayer("p1", "Alice");
      room.addPlayer("p2", "Bob");
      room.addPlayer("p3", "Carol");

      expect(room.isFull).toBe(true);
      expect(room.addPlayer("p4", "Dave")).toBeNull();
    });

    it("does not allow the same player twice", () => {
      room.addPlayer("p1", "Alice");
      expect(room.addPlayer("p1", "Alice")).toBeNull();
    });

    it("reuses empty seats after a player leaves", () => {
      room.addPlayer("p1", "Alice");
      room.addPlayer("p2", "Bob");
      room.removePlayer("p1");

      expect(room.playerCount).toBe(1);
      expect(room.addPlayer("p3", "Carol")).toBe(0);
    });

    it("returns players sorted by seat index after backfill", () => {
      room.addPlayer("p1", "Alice");
      room.addPlayer("p2", "Bob");
      room.addPlayer("p3", "Carol");
      room.removePlayer("p2");
      room.addPlayer("p4", "Dave");

      expect(room.players.map((player) => player.seatIndex)).toEqual([0, 1, 2]);
      expect(room.players.map((player) => player.playerId)).toEqual(["p1", "p4", "p3"]);
    });
  });

  describe("ready / allReady", () => {
    it("reports allReady only when the room is full and everyone is ready", () => {
      room.addPlayer("p1", "Alice");
      room.addPlayer("p2", "Bob");
      room.addPlayer("p3", "Carol");

      room.setReady("p1", true);
      room.setReady("p2", true);
      expect(room.allReady).toBe(false);

      room.setReady("p3", true);
      expect(room.allReady).toBe(true);
    });

    it("counts bot players as ready by default", () => {
      room.addPlayer("p1", "Alice");
      room.addPlayer("bot-1", "Bot 1", "bot");
      room.addPlayer("bot-2", "Bot 2", "bot");

      room.setReady("p1", true);

      expect(room.allReady).toBe(true);
    });

    it("does not report allReady when the room is not full", () => {
      room.addPlayer("p1", "Alice");
      room.setReady("p1", true);
      expect(room.allReady).toBe(false);
    });
  });

  describe("status transitions", () => {
    it("moves to playing", () => {
      room.startPlaying();
      expect(room.status).toBe("playing");
    });

    it("moves to finished", () => {
      room.startPlaying();
      room.finishGame();
      expect(room.status).toBe("finished");
    });

    it("returns to waiting with humans unready and bots still ready", () => {
      room.addPlayer("p1", "Alice");
      room.addPlayer("bot-1", "Bot 1", "bot");
      room.setReady("p1", true);
      room.startPlaying();
      room.finishGame();

      room.backToWaiting();

      expect(room.status).toBe("waiting");
      expect(room.getPlayer("p1")?.isReady).toBe(false);
      expect(room.getPlayer("bot-1")?.isReady).toBe(true);
    });

    it("resetReady clears human readiness but preserves bot readiness", () => {
      room.addPlayer("p1", "Alice");
      room.addPlayer("bot-1", "Bot 1", "bot");
      room.setReady("p1", true);

      room.resetReady();

      expect(room.getPlayer("p1")?.isReady).toBe(false);
      expect(room.getPlayer("bot-1")?.isReady).toBe(true);
    });
  });

  describe("room selection payload", () => {
    it("returns platform room fields from toRoomInfo", () => {
      room.addPlayer("p1", "Alice");

      expect(room.toRoomInfo()).toEqual({
        roomId: "room-1",
        roomName: "Test Room",
        status: "waiting",
        playerCount: 1,
        maxPlayers: 3,
        gameId: "doudizhu",
        gameName: "Doudizhu",
        modeId: "classic",
        modeName: "Classic",
        configSummary: { wildcard: false },
      });
    });

    it("returns platform room fields from toRoomDetail", () => {
      room.addPlayer("p1", "Alice");
      const detail = room.toRoomDetail();

      expect(detail.players).toHaveLength(1);
      expect(detail.players[0].playerName).toBe("Alice");
      expect(detail.gameId).toBe("doudizhu");
      expect(detail.modeId).toBe("classic");
      expect(detail.configSummary).toEqual({ wildcard: false });
    });

    it("stores the selected game and mode", () => {
      const wildcardRoom = new Room("room-w", "Wildcard Room", createSelection({ modeId: "wildcard" }));

      expect(wildcardRoom.gameSelection).toEqual({
        gameId: "doudizhu",
        gameName: "Doudizhu",
        modeId: "wildcard",
        modeName: "Wildcard",
        config: { wildcard: true },
      });
    });
  });

  describe("config vote", () => {
    beforeEach(() => {
      room.addPlayer("p1", "Alice");
      room.addPlayer("p2", "Bob");
      room.addPlayer("p3", "Carol");
    });

    it("starts a config vote with the target selection", () => {
      const nextSelection = createSelection({ modeId: "wildcard" });

      const result = room.startConfigVote("p1", nextSelection);

      expect(result).toEqual({ ok: true, status: "started" });
      expect(room.configVote).not.toBeNull();
      expect(room.configVote?.initiator).toBe("p1");
      expect(room.configVote?.selection).toEqual(nextSelection);
      expect(room.configVote?.votes.get("p1")).toBe(true);
    });

    it("rejects a second vote while one is running", () => {
      room.startConfigVote("p1", createSelection({ modeId: "wildcard" }));

      const result = room.startConfigVote("p2", createSelection({ modeId: "wildcard", config: { wildcard: true, jokerBomb: true } }));

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeTruthy();
      }
    });

    it("does not allow config votes during play", () => {
      room.startPlaying();

      const result = room.startConfigVote("p1", createSelection({ modeId: "wildcard" }));

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeTruthy();
      }
    });

    it("rejects a vote that targets the current selection", () => {
      const result = room.startConfigVote("p1", createSelection());

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeTruthy();
      }
    });

    it("allows config votes after the match is finished", () => {
      room.startPlaying();
      room.finishGame();

      const result = room.startConfigVote("p1", createSelection({ modeId: "wildcard" }));

      expect(result.ok).toBe(true);
    });

    it("passes immediately when the initiator is the only human player", () => {
      const botRoom = new Room("room-bot", "Bot Room", createSelection());
      botRoom.addPlayer("p1", "Alice");
      botRoom.addPlayer("bot-1", "Bot 1", "bot");
      botRoom.addPlayer("bot-2", "Bot 2", "bot");

      const result = botRoom.startConfigVote("p1", createSelection({ modeId: "wildcard" }));

      expect(result).toEqual({
        ok: true,
        status: "resolved",
        result: {
          passed: true,
          selection: createSelection({ modeId: "wildcard" }),
        },
      });
      expect(botRoom.gameSelection.modeId).toBe("wildcard");
      expect(botRoom.configVote).toBeNull();
    });

    it("passes when a supermajority agrees", () => {
      room.startConfigVote("p1", createSelection({ modeId: "wildcard" }));

      const result = room.castConfigVote("p2", true);

      expect(result.ok).toBe(true);
      expect(result.result).toEqual({
        passed: true,
        selection: createSelection({ modeId: "wildcard" }),
      });
    });

    it("fails when a supermajority disagrees", () => {
      room.startConfigVote("p1", createSelection({ modeId: "wildcard" }));
      room.castConfigVote("p2", false);

      const result = room.castConfigVote("p3", false);

      expect(result.ok).toBe(true);
      expect(result.result).toEqual({
        passed: false,
        selection: createSelection({ modeId: "wildcard" }),
      });
    });

    it("fails once all human players have voted even if bots have not", () => {
      room.removePlayer("p3");
      room.addPlayer("bot-1", "Bot 1", "bot");
      room.startConfigVote("p1", createSelection({ modeId: "wildcard" }));

      const result = room.castConfigVote("p2", false);

      expect(result.ok).toBe(true);
      expect(result.result).toEqual({
        passed: false,
        selection: createSelection({ modeId: "wildcard" }),
      });
    });

    it("re-resolves an active vote when a human leaves", () => {
      room.removePlayer("p3");
      room.addPlayer("bot-1", "Bot 1", "bot");
      room.startConfigVote("p1", createSelection({ modeId: "wildcard" }));

      expect(room.removePlayer("p2")).toBe(true);
      expect(room.gameSelection.modeId).toBe("wildcard");
      expect(room.configVote).toBeNull();
      expect(room.consumePendingConfigVoteResult()).toEqual({
        passed: true,
        selection: createSelection({ modeId: "wildcard" }),
      });
      expect(room.consumePendingConfigVoteResult()).toBeNull();
    });

    it("updates the selected mode after a passed vote", () => {
      room.startConfigVote("p1", createSelection({ modeId: "wildcard" }));
      room.castConfigVote("p2", true);

      expect(room.gameSelection.modeId).toBe("wildcard");
      expect(room.gameSelection.config).toEqual({ wildcard: true });
      expect(room.configVote).toBeNull();
    });

    it("does not allow duplicate votes", () => {
      room.startConfigVote("p1", createSelection({ modeId: "wildcard" }));

      const result = room.castConfigVote("p1", true);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeTruthy();
      }
    });

    it("requires an active config vote", () => {
      const result = room.castConfigVote("p1", true);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeTruthy();
      }
    });
  });
});

describe("RoomManager", () => {
  let roomManager: RoomManager;

  beforeEach(() => {
    roomManager = new RoomManager();
  });

  it("creates a room and joins the creator", () => {
    const room = roomManager.createRoom("Test Room", "p1", "Alice", createSelection());

    expect(room.playerCount).toBe(1);
    expect(room.getPlayer("p1")).toMatchObject({ playerType: "human" });
    expect(room.gameSelection.modeId).toBe("classic");
  });

  it("lists all rooms", () => {
    roomManager.createRoom("Room 1", "p1", "Alice", createSelection());
    roomManager.createRoom("Room 2", "p2", "Bob", createSelection({ modeId: "wildcard" }));

    expect(roomManager.listRooms()).toHaveLength(2);
  });

  describe("joinRoom", () => {
    it("joins an existing room", () => {
      const room = roomManager.createRoom("Test", "p1", "Alice", createSelection());

      const result = roomManager.joinRoom(room.roomId, "p2", "Bob");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.room.playerCount).toBe(2);
      }
    });

    it("returns an error when the room does not exist", () => {
      const result = roomManager.joinRoom("missing", "p1", "Alice");
      expect(result.ok).toBe(false);
    });

    it("does not allow joining a full room", () => {
      const room = roomManager.createRoom("Test", "p1", "Alice", createSelection());
      roomManager.joinRoom(room.roomId, "p2", "Bob");
      roomManager.joinRoom(room.roomId, "p3", "Carol");

      const result = roomManager.joinRoom(room.roomId, "p4", "Dave");

      expect(result.ok).toBe(false);
    });

    it("does not allow joining a room that is already playing", () => {
      const room = roomManager.createRoom("Test", "p1", "Alice", createSelection());
      room.startPlaying();

      const result = roomManager.joinRoom(room.roomId, "p2", "Bob");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeTruthy();
      }
    });
  });

  describe("leaveRoom", () => {
    it("decreases the player count when a player leaves", () => {
      const room = roomManager.createRoom("Test", "p1", "Alice", createSelection());
      roomManager.joinRoom(room.roomId, "p2", "Bob");

      roomManager.leaveRoom(room.roomId, "p1");

      expect(room.playerCount).toBe(1);
    });

    it("removes the room when the last player leaves", () => {
      const room = roomManager.createRoom("Test", "p1", "Alice", createSelection());

      const result = roomManager.leaveRoom(room.roomId, "p1");

      expect(result).toBeUndefined();
      expect(roomManager.getRoom(room.roomId)).toBeUndefined();
    });

    it("removes the room when the last human leaves even if bots remain", () => {
      const room = roomManager.createRoom("Test", "p1", "Alice", createSelection());
      roomManager.addBot(room.roomId, "bot-1", "Bot 1");
      roomManager.addBot(room.roomId, "bot-2", "Bot 2");

      const result = roomManager.leaveRoom(room.roomId, "p1");

      expect(result).toBeUndefined();
      expect(roomManager.getRoom(room.roomId)).toBeUndefined();
    });
  });

  describe("findRoomByPlayer", () => {
    it("finds the room by player id", () => {
      const room = roomManager.createRoom("Test", "p1", "Alice", createSelection());

      expect(roomManager.findRoomByPlayer("p1")?.roomId).toBe(room.roomId);
    });

    it("returns undefined when the player is not in a room", () => {
      expect(roomManager.findRoomByPlayer("p999")).toBeUndefined();
    });
  });

  describe("bot management", () => {
    it("adds a bot to an existing waiting room", () => {
      const room = roomManager.createRoom("Test", "p1", "Alice", createSelection());

      const result = roomManager.addBot(room.roomId, "bot-1", "Bot 1");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.seatIndex).toBe(1);
        expect(result.room.getPlayer("bot-1")).toMatchObject({
          playerType: "bot",
          isReady: true,
        });
      }
    });

    it("rejects duplicate bot ids", () => {
      const room = roomManager.createRoom("Test", "p1", "Alice", createSelection());
      roomManager.addBot(room.roomId, "bot-1", "Bot 1");

      const result = roomManager.addBot(room.roomId, "bot-1", "Bot 1 Again");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("Player is already in the room.");
      }
    });

    it("removes a bot by player id", () => {
      const room = roomManager.createRoom("Test", "p1", "Alice", createSelection());
      roomManager.addBot(room.roomId, "bot-1", "Bot 1");

      const result = roomManager.removeBot(room.roomId, "bot-1");

      expect(result.ok).toBe(true);
      expect(room.getPlayer("bot-1")).toBeUndefined();
    });

    it("does not remove a human through removeBot", () => {
      const room = roomManager.createRoom("Test", "p1", "Alice", createSelection());

      const result = roomManager.removeBot(room.roomId, "p1");

      expect(result.ok).toBe(false);
      expect(room.getPlayer("p1")).toBeDefined();
    });
  });
});



