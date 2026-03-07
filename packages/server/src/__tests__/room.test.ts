import { describe, it, expect, beforeEach } from "vitest";
import { Room } from "../room/Room.js";
import { RoomManager } from "../room/RoomManager.js";

describe("Room", () => {
  let room: Room;

  beforeEach(() => {
    room = new Room("room-1", "测试房间");
  });

  it("初始状态为 waiting", () => {
    expect(room.status).toBe("waiting");
    expect(room.playerCount).toBe(0);
    expect(room.isFull).toBe(false);
  });

  describe("addPlayer / removePlayer", () => {
    it("应添加玩家并分配座位", () => {
      const seat = room.addPlayer("p1", "Alice");
      expect(seat).toBe(0);
      expect(room.playerCount).toBe(1);
    });

    it("满员后不能再加入", () => {
      room.addPlayer("p1", "Alice");
      room.addPlayer("p2", "Bob");
      room.addPlayer("p3", "Carol");
      expect(room.isFull).toBe(true);
      expect(room.addPlayer("p4", "Dave")).toBeNull();
    });

    it("同一玩家不能重复加入", () => {
      room.addPlayer("p1", "Alice");
      expect(room.addPlayer("p1", "Alice")).toBeNull();
    });

    it("移除玩家后座位释放", () => {
      room.addPlayer("p1", "Alice");
      room.addPlayer("p2", "Bob");
      room.removePlayer("p1");
      expect(room.playerCount).toBe(1);
      // 新玩家可以拿到空闲座位 0
      const seat = room.addPlayer("p3", "Carol");
      expect(seat).toBe(0);
    });

    it("补位后 players 应按 seatIndex 排序", () => {
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
    it("所有人准备且满员时 allReady 为 true", () => {
      room.addPlayer("p1", "Alice");
      room.addPlayer("p2", "Bob");
      room.addPlayer("p3", "Carol");
      room.setReady("p1", true);
      room.setReady("p2", true);
      expect(room.allReady).toBe(false);
      room.setReady("p3", true);
      expect(room.allReady).toBe(true);
    });

    it("不满员即使全准备也不算 allReady", () => {
      room.addPlayer("p1", "Alice");
      room.setReady("p1", true);
      expect(room.allReady).toBe(false);
    });
  });

  describe("状态转换方法", () => {
    it("startPlaying 应将状态改为 playing", () => {
      room.startPlaying();
      expect(room.status).toBe("playing");
    });

    it("finishGame 应将状态改为 finished", () => {
      room.startPlaying();
      room.finishGame();
      expect(room.status).toBe("finished");
    });

    it("backToWaiting 应回到 waiting 并重置准备状态", () => {
      room.addPlayer("p1", "Alice");
      room.setReady("p1", true);
      room.startPlaying();
      room.finishGame();
      room.backToWaiting();
      expect(room.status).toBe("waiting");
      expect(room.getPlayer("p1")!.isReady).toBe(false);
    });

    it("resetReady 重置所有玩家准备状态", () => {
      room.addPlayer("p1", "Alice");
      room.addPlayer("p2", "Bob");
      room.setReady("p1", true);
      room.setReady("p2", true);
      room.resetReady();
      expect(room.getPlayer("p1")!.isReady).toBe(false);
      expect(room.getPlayer("p2")!.isReady).toBe(false);
    });
  });

  describe("toRoomInfo / toRoomDetail", () => {
    it("toRoomInfo 返回正确结构", () => {
      room.addPlayer("p1", "Alice");
      const info = room.toRoomInfo();
      expect(info).toEqual({
        roomId: "room-1",
        roomName: "测试房间",
        status: "waiting",
        playerCount: 1,
        maxPlayers: 3,
        wildcard: false,
      });
    });

    it("toRoomDetail 包含玩家列表", () => {
      room.addPlayer("p1", "Alice");
      const detail = room.toRoomDetail();
      expect(detail.players).toHaveLength(1);
      expect(detail.players[0].playerName).toBe("Alice");
    });

    it("toRoomInfo 和 toRoomDetail 包含 wildcard", () => {
      const wildcardRoom = new Room("room-w", "赖子房间", true);
      wildcardRoom.addPlayer("p1", "Alice");
      expect(wildcardRoom.toRoomInfo().wildcard).toBe(true);
      expect(wildcardRoom.toRoomDetail().wildcard).toBe(true);
    });
  });

  describe("wildcard 封装", () => {
    it("创建房间时设置 wildcard 模式", () => {
      const wildcardRoom = new Room("room-w", "赖子房间", true);
      expect(wildcardRoom.wildcard).toBe(true);
    });

    it("默认 wildcard 为 false", () => {
      expect(room.wildcard).toBe(false);
    });
  });

  describe("模式投票 (startModeVote / castModeVote)", () => {
    beforeEach(() => {
      room.addPlayer("p1", "Alice");
      room.addPlayer("p2", "Bob");
      room.addPlayer("p3", "Carol");
    });

    it("startModeVote 发起投票成功", () => {
      const result = room.startModeVote("p1", true);
      expect(result.ok).toBe(true);
      expect(room.modeVote).not.toBeNull();
      expect(room.modeVote!.initiator).toBe("p1");
      expect(room.modeVote!.wildcard).toBe(true);
      expect(room.modeVote!.votes.get("p1")).toBe(true); // 发起者自动赞成
    });

    it("startModeVote 重复投票被拒绝", () => {
      room.startModeVote("p1", true);
      const result = room.startModeVote("p2", true);
      expect(result.ok).toBe(false);
      expect(result.error).toContain("已有投票");
    });

    it("startModeVote 游戏中不能投票", () => {
      room.startPlaying();
      const result = room.startModeVote("p1", true);
      expect(result.ok).toBe(false);
      expect(result.error).toContain("游戏中");
    });

    it("startModeVote 投票切换到当前模式被拒绝", () => {
      // room.wildcard 默认为 false, 投票 false 应被拒绝
      const result = room.startModeVote("p1", false);
      expect(result.ok).toBe(false);
      expect(result.error).toContain("当前已有模式");
    });

    it("startModeVote 在 Finished 状态下可以发起投票", () => {
      room.startPlaying();
      room.finishGame();
      const result = room.startModeVote("p1", true);
      expect(result.ok).toBe(true);
    });

    it("castModeVote 2人同意通过", () => {
      room.startModeVote("p1", true); // p1 自动赞成
      const result = room.castModeVote("p2", true);
      expect(result.ok).toBe(true);
      expect(result.result).toEqual({ passed: true, wildcard: true });
    });

    it("castModeVote 2人拒绝否决", () => {
      room.startModeVote("p1", true); // p1 赞成
      room.castModeVote("p2", false);
      const result = room.castModeVote("p3", false);
      expect(result.ok).toBe(true);
      expect(result.result).toEqual({ passed: false, wildcard: true });
    });

    it("castModeVote 投票通过后 wildcard 状态更新", () => {
      expect(room.wildcard).toBe(false);
      room.startModeVote("p1", true);
      room.castModeVote("p2", true);
      expect(room.wildcard).toBe(true);
      expect(room.modeVote).toBeNull(); // 投票结束后清除
    });

    it("castModeVote 不能重复投票", () => {
      room.startModeVote("p1", true);
      const result = room.castModeVote("p1", true); // p1 已经自动投过
      expect(result.ok).toBe(false);
      expect(result.error).toContain("重复投票");
    });

    it("castModeVote 没有进行中的投票时报错", () => {
      const result = room.castModeVote("p1", true);
      expect(result.ok).toBe(false);
      expect(result.error).toContain("没有进行中的投票");
    });
  });
});

describe("RoomManager", () => {
  let rm: RoomManager;

  beforeEach(() => {
    rm = new RoomManager();
  });

  it("创建房间并自动加入创建者", () => {
    const room = rm.createRoom("测试房间", "p1", "Alice");
    expect(room.playerCount).toBe(1);
    expect(room.getPlayer("p1")).toBeDefined();
  });

  it("listRooms 返回所有房间", () => {
    rm.createRoom("房间1", "p1", "Alice");
    rm.createRoom("房间2", "p2", "Bob");
    const list = rm.listRooms();
    expect(list).toHaveLength(2);
  });

  describe("joinRoom", () => {
    it("成功加入已有房间", () => {
      const room = rm.createRoom("测试", "p1", "Alice");
      const result = rm.joinRoom(room.roomId, "p2", "Bob");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.room.playerCount).toBe(2);
      }
    });

    it("加入不存在的房间返回错误", () => {
      const result = rm.joinRoom("nonexistent", "p1", "Alice");
      expect(result.ok).toBe(false);
    });

    it("满员房间无法加入", () => {
      const room = rm.createRoom("测试", "p1", "Alice");
      rm.joinRoom(room.roomId, "p2", "Bob");
      rm.joinRoom(room.roomId, "p3", "Carol");
      const result = rm.joinRoom(room.roomId, "p4", "Dave");
      expect(result.ok).toBe(false);
    });

    it("游戏中的房间无法加入", () => {
      const room = rm.createRoom("测试", "p1", "Alice");
      room.startPlaying();
      const result = rm.joinRoom(room.roomId, "p2", "Bob");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("已开始");
      }
    });
  });

  describe("leaveRoom", () => {
    it("玩家离开后房间人数减少", () => {
      const room = rm.createRoom("测试", "p1", "Alice");
      rm.joinRoom(room.roomId, "p2", "Bob");
      rm.leaveRoom(room.roomId, "p1");
      expect(room.playerCount).toBe(1);
    });

    it("最后一个玩家离开后房间被销毁", () => {
      const room = rm.createRoom("测试", "p1", "Alice");
      rm.leaveRoom(room.roomId, "p1");
      expect(rm.getRoom(room.roomId)).toBeUndefined();
    });
  });

  describe("findRoomByPlayer", () => {
    it("可以找到玩家所在的房间", () => {
      const room = rm.createRoom("测试", "p1", "Alice");
      const found = rm.findRoomByPlayer("p1");
      expect(found?.roomId).toBe(room.roomId);
    });

    it("未在任何房间的玩家返回 undefined", () => {
      expect(rm.findRoomByPlayer("p999")).toBeUndefined();
    });
  });
});
