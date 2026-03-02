import { describe, it, expect, beforeEach } from "vitest";
import { SessionManager } from "../session/SessionManager.js";

describe("SessionManager", () => {
  let sm: SessionManager;

  beforeEach(() => {
    sm = new SessionManager();
  });

  describe("register", () => {
    it("应创建新 session", () => {
      const session = sm.register("token-1", "sock-1", "Alice");
      expect(session.playerId).toBe("token-1");
      expect(session.socketId).toBe("sock-1");
      expect(session.playerName).toBe("Alice");
      expect(session.roomId).toBeNull();
      expect(session.disconnectedAt).toBeNull();
    });

    it("重复 token 应更新 socket 而非创建新 session", () => {
      sm.register("token-1", "sock-1", "Alice");
      const session = sm.register("token-1", "sock-2", "Alice2");
      expect(session.socketId).toBe("sock-2");
      expect(session.playerName).toBe("Alice2");
      // 旧 socket 不再映射
      expect(sm.getBySocketId("sock-1")).toBeUndefined();
      expect(sm.getBySocketId("sock-2")).toBeDefined();
    });
  });

  describe("getByToken / getBySocketId", () => {
    it("可以通过 token 查找 session", () => {
      sm.register("token-1", "sock-1", "Alice");
      const session = sm.getByToken("token-1");
      expect(session?.playerName).toBe("Alice");
    });

    it("可以通过 socketId 查找 session", () => {
      sm.register("token-1", "sock-1", "Alice");
      const session = sm.getBySocketId("sock-1");
      expect(session?.playerId).toBe("token-1");
    });

    it("查找不存在的 token 返回 undefined", () => {
      expect(sm.getByToken("nonexistent")).toBeUndefined();
    });

    it("查找不存在的 socketId 返回 undefined", () => {
      expect(sm.getBySocketId("nonexistent")).toBeUndefined();
    });
  });

  describe("disconnect", () => {
    it("应标记断线并清除 socketId", () => {
      sm.register("token-1", "sock-1", "Alice");
      const session = sm.disconnect("sock-1");
      expect(session).toBeDefined();
      expect(session!.socketId).toBeNull();
      expect(session!.disconnectedAt).toBeTypeOf("number");
    });

    it("断线后 socketId 映射应被清除", () => {
      sm.register("token-1", "sock-1", "Alice");
      sm.disconnect("sock-1");
      expect(sm.getBySocketId("sock-1")).toBeUndefined();
      // 但 token 查找仍然有效
      expect(sm.getByToken("token-1")).toBeDefined();
    });

    it("对不存在的 socketId 断线返回 undefined", () => {
      expect(sm.disconnect("nonexistent")).toBeUndefined();
    });
  });

  describe("reconnect", () => {
    it("应恢复断线 session 并更新 socketId", () => {
      sm.register("token-1", "sock-1", "Alice");
      sm.disconnect("sock-1");
      const session = sm.reconnect("token-1", "sock-2");
      expect(session).toBeDefined();
      expect(session!.socketId).toBe("sock-2");
      expect(session!.disconnectedAt).toBeNull();
      expect(sm.getBySocketId("sock-2")).toBeDefined();
    });

    it("对不存在的 token 重连返回 undefined", () => {
      expect(sm.reconnect("nonexistent", "sock-1")).toBeUndefined();
    });
  });

  describe("getDisconnectedSessions", () => {
    it("应返回所有已断线的 session", () => {
      sm.register("token-1", "sock-1", "Alice");
      sm.register("token-2", "sock-2", "Bob");
      sm.register("token-3", "sock-3", "Carol");

      sm.disconnect("sock-1");
      sm.disconnect("sock-3");

      const disconnected = sm.getDisconnectedSessions();
      expect(disconnected).toHaveLength(2);
      const ids = disconnected.map((s) => s.playerId).sort();
      expect(ids).toEqual(["token-1", "token-3"]);
    });

    it("无断线时返回空数组", () => {
      sm.register("token-1", "sock-1", "Alice");
      expect(sm.getDisconnectedSessions()).toHaveLength(0);
    });
  });

  describe("remove", () => {
    it("应完全移除 session", () => {
      sm.register("token-1", "sock-1", "Alice");
      sm.remove("token-1");
      expect(sm.getByToken("token-1")).toBeUndefined();
      expect(sm.getBySocketId("sock-1")).toBeUndefined();
    });
  });
});
