import { createServer, type Server as HttpServer } from "http";
import { Server } from "socket.io";
import { io as ioc, type Socket as ClientSocket } from "socket.io-client";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type {
  ClientEvents,
  ServerEvents,
  Card,
  GameSnapshot,
  RoomInfo,
  RoomDetail,
  PlayerRole,
  ScoreDetail,
} from "@blitzlord/shared";
import { GamePhase } from "@blitzlord/shared";
import { SessionManager } from "../session/SessionManager.js";
import { RoomManager } from "../room/RoomManager.js";
import { createServerGameRegistry } from "../platform/GameRegistry.js";
import { MatchEngine } from "../platform/MatchEngine.js";
import { createHandlers } from "../socket/handlers.js";

type TypedClientSocket = ClientSocket<ServerEvents, ClientEvents>;

const TEST_PORT = 3099;

let httpServer: HttpServer;
let ioServer: Server<ClientEvents, ServerEvents>;
let sessionManager: SessionManager;
let roomManager: RoomManager;
let matches: Map<string, MatchEngine>;

const clients: TypedClientSocket[] = [];
const DEFAULT_GAME_ID = "doudizhu";
const DEFAULT_MODE_ID = "classic";

function createClient(token: string, playerName: string): Promise<TypedClientSocket> {
  return new Promise((resolve) => {
    const client = ioc(`http://localhost:${TEST_PORT}`, {
      auth: { token, playerName },
      forceNew: true,
      transports: ["websocket"],
    }) as TypedClientSocket;
    client.on("connect", () => {
      resolve(client);
    });
    clients.push(client);
  });
}

function waitForEvent<T>(socket: TypedClientSocket, event: string, timeout = 5000): Promise<T> {
  const promise = new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for event: ${event}`)), timeout);
    socket.once(event as any, (data: any) => {
      clearTimeout(timer);
      resolve(data as T);
    });
  });
  void promise.catch(() => undefined);
  return promise;
}

function waitForGameSnapshot(
  socket: TypedClientSocket,
  predicate: (snapshot: GameSnapshot) => boolean,
  timeout = 5000,
): Promise<GameSnapshot> {
  const promise = new Promise<GameSnapshot>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("match:syncState", onSnapshot);
      reject(new Error("Timeout waiting for matching event: match:syncState"));
    }, timeout);

    const onSnapshot = (snapshot: GameSnapshot) => {
      if (!predicate(snapshot)) {
        return;
      }
      clearTimeout(timer);
      socket.off("match:syncState", onSnapshot);
      resolve(snapshot);
    };

    socket.on("match:syncState", onSnapshot);
  });
  void promise.catch(() => undefined);
  return promise;
}

function emitRaw<T>(
  socket: TypedClientSocket,
  event: string,
  ...args: unknown[]
): Promise<T> {
  return new Promise<T>((resolve) => {
    (socket.emit as (...payload: unknown[]) => void)(event, ...args, resolve as (value: T) => void);
  });
}

beforeAll(
  () =>
    new Promise<void>((resolve) => {
      httpServer = createServer();
      ioServer = new Server<ClientEvents, ServerEvents>(httpServer, {
        cors: { origin: "*" },
      });

      sessionManager = new SessionManager();
      roomManager = new RoomManager();
      matches = new Map();
      const gameRegistry = createServerGameRegistry();

      ioServer.on(
        "connection",
        createHandlers({ io: ioServer, roomManager, sessionManager, gameRegistry, matches }),
      );

      httpServer.listen(TEST_PORT, () => {
        resolve();
      });
    }),
);

afterEach(() => {
  // 断开所有客户端
  for (const c of clients) {
    if (c.connected) c.disconnect();
  }
  clients.length = 0;
});

afterAll(
  () =>
    new Promise<void>((resolve) => {
      ioServer.close();
      httpServer.close(() => resolve());
    }),
);

// ======================== 辅助函数 ========================

async function createRoomWithClient(
  token: string,
  playerName: string,
  roomName: string,
  overrides: Partial<{
    gameId: string;
    modeId: string;
    config: Record<string, unknown>;
  }> = {},
): Promise<{ client: TypedClientSocket; roomId: string }> {
  const client = await createClient(token, playerName);
  const res = await new Promise<{ ok: boolean; roomId?: string; error?: string }>((resolve) => {
    client.emit("room:create", {
      roomName,
      playerName,
      gameId: overrides.gameId ?? DEFAULT_GAME_ID,
      modeId: overrides.modeId ?? DEFAULT_MODE_ID,
      config: overrides.config,
    }, resolve);
  });
  expect(res.ok).toBe(true);
  return { client, roomId: res.roomId! };
}

async function joinRoom(
  token: string,
  playerName: string,
  roomId: string,
): Promise<TypedClientSocket> {
  const client = await createClient(token, playerName);
  const res = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
    client.emit("room:join", { roomId, playerName }, resolve);
  });
  expect(res.ok).toBe(true);
  return client;
}

async function readyAndStartGame(
  c1: TypedClientSocket,
  c2: TypedClientSocket,
  c3: TypedClientSocket,
): Promise<{
  hands: Map<TypedClientSocket, Card[]>;
  snapshots: Map<TypedClientSocket, GameSnapshot>;
  firstCaller: string;
  players: { playerId: string; playerName: string; seatIndex: number }[];
  playerIds: string[];
}> {
  const hands = new Map<TypedClientSocket, Card[]>();
  const snapshots = new Map<TypedClientSocket, GameSnapshot>();

  // 每个客户端等待 match:started
  const startedPromises = [
    waitForEvent<void>(c1, "match:started"),
    waitForEvent<void>(c2, "match:started"),
    waitForEvent<void>(c3, "match:started"),
  ];
  const syncPromises = [
    waitForEvent<GameSnapshot>(c1, "match:syncState"),
    waitForEvent<GameSnapshot>(c2, "match:syncState"),
    waitForEvent<GameSnapshot>(c3, "match:syncState"),
  ];

  // 三人准备
  c1.emit("match:ready");
  c2.emit("match:ready");
  c3.emit("match:ready");

  await Promise.all(startedPromises);
  const [r1, r2, r3] = await Promise.all(syncPromises);

  snapshots.set(c1, r1);
  snapshots.set(c2, r2);
  snapshots.set(c3, r3);
  hands.set(c1, r1.myHand);
  hands.set(c2, r2.myHand);
  hands.set(c3, r3.myHand);

  return {
    hands,
    snapshots,
    firstCaller: r1.currentTurn!,
    players: r1.players.map((player, seatIndex) => ({
      playerId: player.playerId,
      playerName: player.playerName,
      seatIndex,
    })),
    playerIds: r1.players.map((player) => player.playerId),
  };
}

function getClientByPlayerId(
  clientMap: Map<string, TypedClientSocket>,
  playerId: string,
): TypedClientSocket {
  return clientMap.get(playerId)!;
}

// ======================== 测试用例 ========================

describe("Socket handlers 集成测试", () => {
  it("supports the unified match protocol for ready/start/action/sync", async () => {
    const { client: c1, roomId } = await createRoomWithClient("token-m1", "Alice", "Match Protocol Room");
    const c2 = await joinRoom("token-m2", "Bob", roomId);
    const c3 = await joinRoom("token-m3", "Carol", roomId);
    const clientMap = new Map<string, TypedClientSocket>([
      ["token-m1", c1],
      ["token-m2", c2],
      ["token-m3", c3],
    ]);

    const startedPromise = waitForEvent<void>(c1, "match:started");
    const initialSyncPromise = waitForEvent<GameSnapshot>(c1, "match:syncState");

    (c1.emit as (...payload: unknown[]) => void)("match:ready");
    (c2.emit as (...payload: unknown[]) => void)("match:ready");
    (c3.emit as (...payload: unknown[]) => void)("match:ready");

    await startedPromise;
    const initialSnapshot = await initialSyncPromise;
    expect(initialSnapshot.myHand).toHaveLength(17);

    const decidedSyncPromise = waitForEvent<GameSnapshot>(c1, "match:syncState");

    const actionResult = await emitRaw<{ ok: boolean; error?: string }>(
      getClientByPlayerId(clientMap, initialSnapshot.currentTurn!),
      "match:action",
      { type: "callBid", bid: 3 },
    );
    expect(actionResult.ok).toBe(true);

    const snapshot = await decidedSyncPromise;
    expect(snapshot.phase).toBe(GamePhase.Playing);
    expect(snapshot.baseBid).toBe(3);
  });
  describe("创建房间 → 加入 → 准备 → 游戏开始 → 收到手牌", () => {
    it("完整流程应工作正常", async () => {
      // 玩家 1 创建房间
      const { client: c1, roomId } = await createRoomWithClient("token-a1", "Alice", "测试房间");

      // 玩家 2 加入
      const c2 = await joinRoom("token-a2", "Bob", roomId);

      // 玩家 3 加入
      const c3 = await joinRoom("token-a3", "Carol", roomId);

      // 获取房间列表
      const rooms = await new Promise<RoomInfo[]>((resolve) => {
        c1.emit("room:list", resolve);
      });
      expect(rooms.length).toBeGreaterThanOrEqual(1);
      const targetRoom = rooms.find((r) => r.roomId === roomId);
      expect(targetRoom).toBeDefined();
      expect(targetRoom!.playerCount).toBe(3);
      expect(targetRoom!.gameId).toBe("doudizhu");
      expect(targetRoom!.modeId).toBe("classic");

      // 三人准备并开始游戏
      const { hands, firstCaller, players } = await readyAndStartGame(c1, c2, c3);

      // 每人应有 17 张牌
      for (const [, hand] of hands) {
        expect(hand).toHaveLength(17);
      }

      // firstCaller 应该是三个玩家之一
      const playerIds = players.map((p) => p.playerId);
      expect(playerIds).toContain(firstCaller);

      // players 应包含三个玩家
      expect(players).toHaveLength(3);
    });
  });

  describe("room:voteConfigChange", () => {
    it("can switch the room mode through a config vote", async () => {
      const { client: c1, roomId } = await createRoomWithClient("token-v1", "Alice", "Config Vote Room");
      const c2 = await joinRoom("token-v2", "Bob", roomId);
      await joinRoom("token-v3", "Carol", roomId);

      const startedPromise = waitForEvent<{
        initiator: string;
        gameId?: string;
        modeId?: string;
        configPatch?: Record<string, unknown>;
      }>(c2, "room:voteConfigChangeStarted");

      const requestResult = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
        c1.emit("room:voteConfigChange", { modeId: "wildcard" }, resolve);
      });
      expect(requestResult.ok).toBe(true);

      const started = await startedPromise;
      expect(started.initiator).toBe("token-v1");
      expect(started.modeId).toBe("wildcard");

      const resultPromise = waitForEvent<{
        passed: boolean;
        gameId?: string;
        modeId?: string;
        configPatch?: Record<string, unknown>;
      }>(c1, "room:voteConfigChangeResult");
      const updatedPromise = waitForEvent<RoomDetail>(c1, "room:updated");

      const voteResult = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
        c2.emit("room:voteConfigChangeVote", { agree: true }, resolve);
      });
      expect(voteResult.ok).toBe(true);

      const result = await resultPromise;
      expect(result.passed).toBe(true);
      expect(result.gameId).toBe("doudizhu");
      expect(result.modeId).toBe("wildcard");
      expect(result.configPatch).toEqual({ wildcard: true });

      const updatedRoom = await updatedPromise;
      expect(updatedRoom.modeId).toBe("wildcard");
      expect(updatedRoom.configSummary).toEqual({ wildcard: true });
    });
  });

  describe("room:requestSync", () => {
    it("已在房间中的玩家应拿到当前房间详情", async () => {
      const { client: c1, roomId } = await createRoomWithClient("token-r1", "Alice", "同步房间");

      const syncResult = await new Promise<{
        ok: boolean;
        room?: RoomDetail;
        error?: string;
      }>((resolve) => {
        c1.emit("room:requestSync", resolve);
      });

      expect(syncResult.ok).toBe(true);
      expect(syncResult.room?.roomId).toBe(roomId);
      expect(syncResult.room?.players).toHaveLength(1);
      expect(syncResult.room?.players[0].playerId).toBe("token-r1");
      expect(syncResult.room?.gameId).toBe("doudizhu");
      expect(syncResult.room?.modeId).toBe("classic");
    });

    it("游戏结束后 room:requestSync 应返回重置后的等待房间", async () => {
      const { client: c1, roomId } = await createRoomWithClient("token-r2", "Alice", "结算同步");
      const c2 = await joinRoom("token-r3", "Bob", roomId);
      const c3 = await joinRoom("token-r4", "Carol", roomId);

      const { firstCaller } = await readyAndStartGame(c1, c2, c3);

      const tokenClientMap = new Map<string, TypedClientSocket>([
        ["token-r2", c1],
        ["token-r3", c2],
        ["token-r4", c3],
      ]);

      const callerClient = tokenClientMap.get(firstCaller)!;
      const landlordSyncPromise = waitForGameSnapshot(
        callerClient,
        (snapshot) =>
          snapshot.phase === GamePhase.Playing &&
          snapshot.currentTurn === firstCaller &&
          snapshot.baseBid === 3 &&
          snapshot.myHand.length === 20,
      );
      await emitRaw<{ ok: boolean; error?: string }>(
        callerClient,
        "match:action",
        { type: "callBid", bid: 3 },
      );

      await new Promise((resolve) => setTimeout(resolve, 200));

      const gameEndPromise = waitForEvent<{
        winnerId: string;
        winnerRole: PlayerRole;
        scores: Record<string, ScoreDetail>;
      }>(c2, "match:ended");
      c1.emit("room:leave");
      await gameEndPromise;

      const syncResult = await new Promise<{
        ok: boolean;
        room?: RoomDetail;
        error?: string;
      }>((resolve) => {
        c2.emit("room:requestSync", resolve);
      });

      expect(syncResult.ok).toBe(true);
      expect(syncResult.room?.roomId).toBe(roomId);
      expect(syncResult.room?.status).toBe("waiting");
      expect(syncResult.room?.players).toHaveLength(2);
      expect(syncResult.room?.players.every((player) => player.isReady === false)).toBe(true);
      expect(syncResult.room?.modeId).toBe("classic");
    });
  });

  describe("叫分 → 叫 3 分直接成为地主", () => {
    it("叫 3 分应直接决定地主", async () => {
      const { client: c1, roomId } = await createRoomWithClient("token-b1", "Alice", "叫分测试");
      const c2 = await joinRoom("token-b2", "Bob", roomId);
      const c3 = await joinRoom("token-b3", "Carol", roomId);

      const { firstCaller } = await readyAndStartGame(c1, c2, c3);

      // 建立 playerId → client 映射
      const tokenClientMap = new Map<string, TypedClientSocket>([
        ["token-b1", c1],
        ["token-b2", c2],
        ["token-b3", c3],
      ]);

      const callerClient = tokenClientMap.get(firstCaller)!;

      // 这里直接等待进入出牌阶段后的快照，不再监听旧的增量事件。
      const landlordSyncPromise = waitForGameSnapshot(
        callerClient,
        (snapshot) =>
          snapshot.phase === GamePhase.Playing &&
          snapshot.currentTurn === firstCaller &&
          snapshot.baseBid === 3 &&
          snapshot.myHand.length === 20,
      );

      // 叫 3 分
      const callRes = await emitRaw<{ ok: boolean; error?: string }>(
        callerClient,
        "match:action",
        { type: "callBid", bid: 3 },
      );
      expect(callRes.ok).toBe(true);

      const landlordSnapshot = await landlordSyncPromise;
      expect(landlordSnapshot.currentTurn).toBe(firstCaller);
      expect(landlordSnapshot.baseBid).toBe(3);
      expect(landlordSnapshot.bottomCards).toHaveLength(3);
      expect(landlordSnapshot.myHand).toHaveLength(20);
    });
  });

  describe("出牌 → 不出 → 轮次切换", () => {
    it("出牌和 pass 应正确切换轮次", async () => {
      const { client: c1, roomId } = await createRoomWithClient("token-c1", "Alice", "出牌测试");
      const c2 = await joinRoom("token-c2", "Bob", roomId);
      const c3 = await joinRoom("token-c3", "Carol", roomId);

      const { firstCaller } = await readyAndStartGame(c1, c2, c3);

      const tokenClientMap = new Map<string, TypedClientSocket>([
        ["token-c1", c1],
        ["token-c2", c2],
        ["token-c3", c3],
      ]);

      const callerClient = tokenClientMap.get(firstCaller)!;
      const landlordSyncPromise = waitForEvent<GameSnapshot>(callerClient, "match:syncState");

      // 这里等待地主叫 3 分后的快照推进，不再依赖旧的轮次增量通知。

      // 叫 3 分成为地主
      const callRes = await emitRaw<{ ok: boolean; error?: string }>(
        callerClient,
        "match:action",
        { type: "callBid", bid: 3 },
      );
      expect(callRes.ok).toBe(true);

      // 等待轮次通知
      const snapshot = await landlordSyncPromise;

      // 地主先出牌
      expect(snapshot.currentTurn).toBe(firstCaller);

      // 地主请求同步获取最新手牌（含底牌）
      expect(snapshot.myHand).toHaveLength(20);

      // 地主出最小的牌（最后一张）
      const landlordHand = snapshot.myHand;
      const cardToPlay = landlordHand[landlordHand.length - 1];
      const callerAfterPlaySyncPromise = waitForGameSnapshot(
        callerClient,
        (syncSnapshot) =>
          syncSnapshot.lastPlay?.playerId === firstCaller && syncSnapshot.myHand.length === 19,
      );

      // 先注册监听器，再触发出牌
      const playRes = await emitRaw<{ ok: boolean; error?: string }>(
        callerClient,
        "match:action",
        { type: "playCards", cards: [cardToPlay] },
      );
      expect(playRes.ok).toBe(true);

      const callerAfterPlaySnapshot = await callerAfterPlaySyncPromise;
      expect(callerAfterPlaySnapshot.myHand).toHaveLength(19);

      const nextPlayerId = callerAfterPlaySnapshot.currentTurn!;
      expect(nextPlayerId).not.toBe(firstCaller);

      // 先准备 pass 后的快照等待条件，再触发 pass
      const nextClient = tokenClientMap.get(nextPlayerId)!;
      const playerOrder = callerAfterPlaySnapshot.players.map((player) => player.playerId);
      const nextPlayerIndex = playerOrder.indexOf(nextPlayerId);
      expect(nextPlayerIndex).toBeGreaterThanOrEqual(0);
      const expectedAfterPassPlayerId = playerOrder[(nextPlayerIndex + 1) % playerOrder.length];

      const afterPassSyncPromise = waitForGameSnapshot(
        c1,
        (syncSnapshot) =>
          syncSnapshot.lastPlay?.playerId === firstCaller &&
          syncSnapshot.currentTurn === expectedAfterPassPlayerId,
      );

      const passRes = await emitRaw<{ ok: boolean; error?: string }>(
        nextClient,
        "match:action",
        { type: "pass" },
      );
      expect(passRes.ok).toBe(true);

      const afterPassSnapshot = await afterPassSyncPromise;
      expect(afterPassSnapshot.currentTurn).toBe(expectedAfterPassPlayerId);
      expect(afterPassSnapshot.lastPlay?.playerId).toBe(firstCaller);
    });

    it("连续两次 pass 后应广播 resetRound=true", async () => {
      const { client: c1, roomId } = await createRoomWithClient("token-c4", "Alice", "pass 重置测试");
      const c2 = await joinRoom("token-c5", "Bob", roomId);
      const c3 = await joinRoom("token-c6", "Carol", roomId);

      const { firstCaller } = await readyAndStartGame(c1, c2, c3);

      const tokenClientMap = new Map<string, TypedClientSocket>([
        ["token-c4", c1],
        ["token-c5", c2],
        ["token-c6", c3],
      ]);

      const callerClient = tokenClientMap.get(firstCaller)!;
      const landlordSyncPromise = waitForGameSnapshot(
        callerClient,
        (syncSnapshot) =>
          syncSnapshot.phase === GamePhase.Playing &&
          syncSnapshot.currentTurn === firstCaller &&
          syncSnapshot.baseBid === 3 &&
          syncSnapshot.myHand.length === 20,
      );

      await emitRaw<{ ok: boolean; error?: string }>(
        callerClient,
        "match:action",
        { type: "callBid", bid: 3 },
      );
      const snapshot = await landlordSyncPromise;
      const cardToPlay = snapshot.myHand[snapshot.myHand.length - 1];

      const afterPlaySyncPromise = waitForGameSnapshot(
        callerClient,
        (syncSnapshot) =>
          syncSnapshot.lastPlay?.playerId === firstCaller && syncSnapshot.currentTurn !== firstCaller,
      );
      await emitRaw<{ ok: boolean; error?: string }>(
        callerClient,
        "match:action",
        { type: "playCards", cards: [cardToPlay] },
      );
      const firstPassPlayerId = (await afterPlaySyncPromise).currentTurn!;

      const firstPassClient = tokenClientMap.get(firstPassPlayerId)!;
      const firstPassSyncPromise = waitForGameSnapshot(
        c1,
        (syncSnapshot) =>
          syncSnapshot.lastPlay?.playerId === firstCaller &&
          syncSnapshot.currentTurn !== firstPassPlayerId,
      );
      const firstPassRes = await emitRaw<{ ok: boolean; error?: string }>(
        firstPassClient,
        "match:action",
        { type: "pass" },
      );
      expect(firstPassRes.ok).toBe(true);
      const firstPassSnapshot = await firstPassSyncPromise;
      expect(firstPassSnapshot.lastPlay?.playerId).toBe(firstCaller);

      const secondPassPlayerId = firstPassSnapshot.currentTurn!;
      const secondPassClient = tokenClientMap.get(secondPassPlayerId)!;
      const secondPassSyncPromise = waitForGameSnapshot(
        c1,
        (syncSnapshot) =>
          syncSnapshot.lastPlay === null &&
          syncSnapshot.currentTurn === firstPassSnapshot.lastPlay?.playerId,
      );
      const secondPassRes = await emitRaw<{ ok: boolean; error?: string }>(
        secondPassClient,
        "match:action",
        { type: "pass" },
      );
      expect(secondPassRes.ok).toBe(true);

      const secondPassSnapshot = await secondPassSyncPromise;
      expect(secondPassSnapshot.currentTurn).toBe(firstPassSnapshot.lastPlay?.playerId);
      expect(secondPassSnapshot.lastPlay).toBeNull();
    });
  });

  describe("断线重连 → 收到 syncState", () => {
    it("断线后重连应收到完整游戏状态", async () => {
      const { client: c1, roomId } = await createRoomWithClient("token-d1", "Alice", "重连测试");
      const c2 = await joinRoom("token-d2", "Bob", roomId);
      const c3 = await joinRoom("token-d3", "Carol", roomId);

      const { firstCaller } = await readyAndStartGame(c1, c2, c3);

      const tokenClientMap = new Map<string, TypedClientSocket>([
        ["token-d1", c1],
        ["token-d2", c2],
        ["token-d3", c3],
      ]);

      // 叫 3 分进入出牌阶段
      const callerClient = tokenClientMap.get(firstCaller)!;
      await emitRaw<{ ok: boolean }>(
        callerClient,
        "match:action",
        { type: "callBid", bid: 3 },
      );

      // 等一下让所有事件传播完
      await new Promise((r) => setTimeout(r, 200));

      // 玩家 2 断线
      const disconnectPromise = waitForEvent<{ playerId: string }>(c1, "player:disconnected");
      c2.disconnect();

      const discData = await disconnectPromise;
      expect(discData.playerId).toBe("token-d2");

      // 玩家 2 重连 — 需要在 connect 之前注册 syncState 监听
      // 因为服务端在 connection handler 中就会推送 syncState
      const reconnectPromise = waitForEvent<{ playerId: string }>(c1, "player:reconnected");

      const c2New = ioc(`http://localhost:${TEST_PORT}`, {
        auth: { token: "token-d2", playerName: "Bob" },
        forceNew: true,
        transports: ["websocket"],
      }) as TypedClientSocket;
      clients.push(c2New);

      // 在 connect 之前就注册 syncState 监听
      const syncPromise = waitForEvent<GameSnapshot>(c2New, "match:syncState");

      // 等待连接完成
      await new Promise<void>((resolve) => c2New.on("connect", resolve));

      const reconnData = await reconnectPromise;
      expect(reconnData.playerId).toBe("token-d2");

      // 重连后应自动收到 syncState
      const syncState = await syncPromise;

      expect(syncState.roomId).toBe(roomId);
      expect(syncState.phase).toBe(GamePhase.Playing);
      // 如果 Bob 是叫 3 分的地主（firstCaller === token-d2），手牌为 20 张；否则 17 张
      const expectedLength = firstCaller === "token-d2" ? 20 : 17;
      expect(syncState.myHand).toHaveLength(expectedLength);
      expect(syncState.players).toHaveLength(3);
    });
  });

  describe("room:leave 在游戏中", () => {
    it("游戏中离开应立即结束游戏", async () => {
      const { client: c1, roomId } = await createRoomWithClient("token-e1", "Alice", "离开测试");
      const c2 = await joinRoom("token-e2", "Bob", roomId);
      const c3 = await joinRoom("token-e3", "Carol", roomId);

      const { firstCaller } = await readyAndStartGame(c1, c2, c3);

      const tokenClientMap = new Map<string, TypedClientSocket>([
        ["token-e1", c1],
        ["token-e2", c2],
        ["token-e3", c3],
      ]);

      // 叫分进入出牌阶段
      const callerClient = tokenClientMap.get(firstCaller)!;
      await emitRaw<{ ok: boolean }>(
        callerClient,
        "match:action",
        { type: "callBid", bid: 3 },
      );

      // 等待事件传播
      await new Promise((r) => setTimeout(r, 200));

      // c1 离开房间 → 应触发 match:ended
      const gameEndPromise = waitForEvent<{
        winnerId: string;
        winnerRole: PlayerRole;
        scores: Record<string, ScoreDetail>;
      }>(c2, "match:ended");

      c1.emit("room:leave");

      const endResult = await gameEndPromise;
      expect(endResult.winnerId).toBeDefined();
      expect(endResult.scores).toBeDefined();
    });
  });
});
