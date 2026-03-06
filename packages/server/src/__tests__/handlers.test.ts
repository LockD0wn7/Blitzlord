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
  CardPlay,
  PlayerRole,
  ScoreDetail,
} from "@blitzlord/shared";
import { GamePhase } from "@blitzlord/shared";
import { SessionManager } from "../session/SessionManager.js";
import { RoomManager } from "../room/RoomManager.js";
import { GameManager } from "../game/GameManager.js";
import { createHandlers } from "../socket/handlers.js";

type TypedClientSocket = ClientSocket<ServerEvents, ClientEvents>;

const TEST_PORT = 3099;

let httpServer: HttpServer;
let ioServer: Server<ClientEvents, ServerEvents>;
let sessionManager: SessionManager;
let roomManager: RoomManager;
let games: Map<string, GameManager>;

const clients: TypedClientSocket[] = [];

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
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for event: ${event}`)), timeout);
    socket.once(event as any, (data: any) => {
      clearTimeout(timer);
      resolve(data as T);
    });
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
      games = new Map();

      ioServer.on(
        "connection",
        createHandlers({ io: ioServer, roomManager, sessionManager, games }),
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
): Promise<{ client: TypedClientSocket; roomId: string }> {
  const client = await createClient(token, playerName);
  const res = await new Promise<{ ok: boolean; roomId?: string; error?: string }>((resolve) => {
    client.emit("room:create", { roomName, playerName }, resolve);
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
  firstCaller: string;
  players: { playerId: string; playerName: string; seatIndex: number }[];
}> {
  const hands = new Map<TypedClientSocket, Card[]>();

  // 每个客户端等待 game:started
  const p1 = waitForEvent<{ hand: Card[]; firstCaller: string; players: { playerId: string; playerName: string; seatIndex: number }[] }>(c1, "game:started");
  const p2 = waitForEvent<{ hand: Card[]; firstCaller: string; players: { playerId: string; playerName: string; seatIndex: number }[] }>(c2, "game:started");
  const p3 = waitForEvent<{ hand: Card[]; firstCaller: string; players: { playerId: string; playerName: string; seatIndex: number }[] }>(c3, "game:started");

  // 三人准备
  c1.emit("game:ready");
  c2.emit("game:ready");
  c3.emit("game:ready");

  const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

  hands.set(c1, r1.hand);
  hands.set(c2, r2.hand);
  hands.set(c3, r3.hand);

  return { hands, firstCaller: r1.firstCaller, players: r1.players };
}

function getClientByPlayerId(
  clientMap: Map<string, TypedClientSocket>,
  playerId: string,
): TypedClientSocket {
  return clientMap.get(playerId)!;
}

// ======================== 测试用例 ========================

describe("Socket handlers 集成测试", () => {
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
      await new Promise<{ ok: boolean; error?: string }>((resolve) => {
        callerClient.emit("game:callLandlord", { bid: 3 }, resolve);
      });

      await new Promise((resolve) => setTimeout(resolve, 200));

      const gameEndPromise = waitForEvent<{
        winnerId: string;
        winnerRole: PlayerRole;
        scores: Record<string, ScoreDetail>;
      }>(c2, "game:ended");
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

      // 等待 landlordDecided 事件（任意客户端）
      const landlordPromise = waitForEvent<{
        landlordId: string;
        bottomCards: Card[];
        baseBid: 1 | 2 | 3;
      }>(c1, "game:landlordDecided");

      // 叫 3 分
      const callRes = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
        callerClient.emit("game:callLandlord", { bid: 3 }, resolve);
      });
      expect(callRes.ok).toBe(true);

      const landlordData = await landlordPromise;
      expect(landlordData.landlordId).toBe(firstCaller);
      expect(landlordData.baseBid).toBe(3);
      expect(landlordData.bottomCards).toHaveLength(3);
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

      // 在叫分前注册 turnChanged 监听器（叫 3 分后服务端会立即发 turnChanged）
      const turnPromise = waitForEvent<{ currentTurn: string }>(c1, "game:turnChanged");

      // 叫 3 分成为地主
      const callRes = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
        callerClient.emit("game:callLandlord", { bid: 3 }, resolve);
      });
      expect(callRes.ok).toBe(true);

      // 等待轮次通知
      const turnData = await turnPromise;

      // 地主先出牌
      expect(turnData.currentTurn).toBe(firstCaller);

      // 地主请求同步获取最新手牌（含底牌）
      const syncPromise = waitForEvent<GameSnapshot>(callerClient, "game:syncState");
      callerClient.emit("game:requestSync");
      const snapshot = await syncPromise;
      expect(snapshot.myHand).toHaveLength(20);

      // 地主出最小的牌（最后一张）
      const landlordHand = snapshot.myHand;
      const cardToPlay = landlordHand[landlordHand.length - 1];

      // 先注册监听器，再触发出牌
      const cardsPlayedPromise = waitForEvent<{
        playerId: string;
        play: CardPlay;
        remainingCards: number;
      }>(c2, "game:cardsPlayed");
      const nextTurnPromise = waitForEvent<{ currentTurn: string }>(c1, "game:turnChanged");

      const playRes = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
        callerClient.emit("game:playCards", { cards: [cardToPlay] }, resolve);
      });
      expect(playRes.ok).toBe(true);

      const cardsPlayed = await cardsPlayedPromise;
      expect(cardsPlayed.playerId).toBe(firstCaller);
      expect(cardsPlayed.remainingCards).toBe(19);

      const nextTurn = await nextTurnPromise;
      const nextPlayerId = nextTurn.currentTurn;
      expect(nextPlayerId).not.toBe(firstCaller);

      // 先注册 pass 和 turnChanged 的监听器，再触发 pass
      const nextClient = tokenClientMap.get(nextPlayerId)!;
      const expectedThirdPlayerId = Array.from(tokenClientMap.keys()).find(
        (playerId) => playerId !== firstCaller && playerId !== nextPlayerId,
      );
      expect(expectedThirdPlayerId).toBeDefined();

      const passedPromise = waitForEvent<{ playerId: string; resetRound: boolean }>(c1, "game:passed");
      const thirdTurnPromise = waitForEvent<{ currentTurn: string }>(c1, "game:turnChanged");

      const passRes = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
        nextClient.emit("game:pass", resolve);
      });
      expect(passRes.ok).toBe(true);

      const passedData = await passedPromise;
      expect(passedData.playerId).toBe(nextPlayerId);
      expect(passedData.resetRound).toBe(false);

      const thirdTurn = await thirdTurnPromise;
      expect(thirdTurn.currentTurn).toBe(expectedThirdPlayerId);
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
      const firstTurnPromise = waitForEvent<{ currentTurn: string }>(c1, "game:turnChanged");

      await new Promise<{ ok: boolean; error?: string }>((resolve) => {
        callerClient.emit("game:callLandlord", { bid: 3 }, resolve);
      });
      await firstTurnPromise;

      const syncPromise = waitForEvent<GameSnapshot>(callerClient, "game:syncState");
      callerClient.emit("game:requestSync");
      const snapshot = await syncPromise;
      const cardToPlay = snapshot.myHand[snapshot.myHand.length - 1];

      const nextTurnPromise = waitForEvent<{ currentTurn: string }>(c1, "game:turnChanged");
      await new Promise<{ ok: boolean; error?: string }>((resolve) => {
        callerClient.emit("game:playCards", { cards: [cardToPlay] }, resolve);
      });
      const firstPassPlayerId = (await nextTurnPromise).currentTurn;

      const firstPassClient = tokenClientMap.get(firstPassPlayerId)!;
      const firstPassEventPromise = waitForEvent<{ playerId: string; resetRound: boolean }>(c1, "game:passed");
      const secondTurnPromise = waitForEvent<{ currentTurn: string }>(c1, "game:turnChanged");
      await new Promise<{ ok: boolean; error?: string }>((resolve) => {
        firstPassClient.emit("game:pass", resolve);
      });
      const firstPassEvent = await firstPassEventPromise;
      expect(firstPassEvent.playerId).toBe(firstPassPlayerId);
      expect(firstPassEvent.resetRound).toBe(false);

      const secondPassPlayerId = (await secondTurnPromise).currentTurn;
      const secondPassClient = tokenClientMap.get(secondPassPlayerId)!;
      const secondPassEventPromise = waitForEvent<{ playerId: string; resetRound: boolean }>(c1, "game:passed");
      const resetTurnPromise = waitForEvent<{ currentTurn: string }>(c1, "game:turnChanged");
      await new Promise<{ ok: boolean; error?: string }>((resolve) => {
        secondPassClient.emit("game:pass", resolve);
      });

      const secondPassEvent = await secondPassEventPromise;
      expect(secondPassEvent.playerId).toBe(secondPassPlayerId);
      expect(secondPassEvent.resetRound).toBe(true);

      const resetTurn = await resetTurnPromise;
      expect(resetTurn.currentTurn).toBe(firstCaller);
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
      await new Promise<{ ok: boolean }>((resolve) => {
        callerClient.emit("game:callLandlord", { bid: 3 }, resolve);
      });

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
      const syncPromise = waitForEvent<GameSnapshot>(c2New, "game:syncState");

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
      await new Promise<{ ok: boolean }>((resolve) => {
        callerClient.emit("game:callLandlord", { bid: 3 }, resolve);
      });

      // 等待事件传播
      await new Promise((r) => setTimeout(r, 200));

      // c1 离开房间 → 应触发 game:ended
      const gameEndPromise = waitForEvent<{
        winnerId: string;
        winnerRole: PlayerRole;
        scores: Record<string, ScoreDetail>;
      }>(c2, "game:ended");

      c1.emit("room:leave");

      const endResult = await gameEndPromise;
      expect(endResult.winnerId).toBeDefined();
      expect(endResult.scores).toBeDefined();
    });
  });
});
