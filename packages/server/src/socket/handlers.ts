import type { Server, Socket } from "socket.io";
import type { ClientEvents, MatchActionData, ServerEvents } from "@blitzlord/shared";
import {
  DISCONNECT_TIMEOUT_MS,
  GamePhase,
  getGameDefinition,
  getModeDefinition,
  registerGame,
  RoomStatus,
} from "@blitzlord/shared";
import { doudizhuDefinition } from "@blitzlord/shared/games/doudizhu";
import { SessionManager } from "../session/SessionManager.js";
import { RoomManager } from "../room/RoomManager.js";
import type { ConfigVoteResult, Room, RoomGameSelection } from "../room/Room.js";
import type { MatchEngine } from "../platform/MatchEngine.js";
import type { MatchAction } from "../platform/actionHandlers.js";
import type { ServerGameRegistry } from "../platform/GameRegistry.js";
import { BotController } from "../bot/BotController.js";

type TypedServer = Server<ClientEvents, ServerEvents>;
type TypedSocket = Socket<ClientEvents, ServerEvents>;

export interface HandlerDeps {
  io: TypedServer;
  roomManager: RoomManager;
  sessionManager: SessionManager;
  gameRegistry: ServerGameRegistry;
  matches: Map<string, MatchEngine>;
}

function asConfigRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return { ...(value as Record<string, unknown>) };
}

function ensureBuiltInGamesRegistered(): void {
  if (!getGameDefinition(doudizhuDefinition.gameId)) {
    registerGame(doudizhuDefinition);
  }
}

function resolveSelection(gameId: string, modeId: string, config?: Record<string, unknown>): RoomGameSelection | null {
  ensureBuiltInGamesRegistered();

  const game = getGameDefinition(gameId);
  const mode = getModeDefinition(gameId, modeId);
  if (!game || !mode) {
    return null;
  }

  return {
    gameId: game.gameId,
    gameName: game.gameName,
    modeId: mode.modeId,
    modeName: mode.modeName,
    config: {
      ...(config ?? {}),
      ...asConfigRecord(mode.defaultConfig),
    },
  };
}

function resolveSelectionFromPatch(
  currentSelection: RoomGameSelection,
  data: { gameId?: string; modeId?: string; configPatch?: Record<string, unknown> },
): RoomGameSelection | null {
  ensureBuiltInGamesRegistered();

  const gameId = data.gameId ?? currentSelection.gameId;
  const modeId = data.modeId ?? currentSelection.modeId;
  const game = getGameDefinition(gameId);
  const mode = getModeDefinition(gameId, modeId);
  if (!game || !mode) {
    return null;
  }

  const selectionChanged = gameId !== currentSelection.gameId || modeId !== currentSelection.modeId;
  const baseConfig = selectionChanged
    ? asConfigRecord(mode.defaultConfig)
    : currentSelection.config;

  return {
    gameId: game.gameId,
    gameName: game.gameName,
    modeId: mode.modeId,
    modeName: mode.modeName,
    config: {
      ...baseConfig,
      ...(data.configPatch ?? {}),
      ...asConfigRecord(mode.defaultConfig),
    },
  };
}

function emitConfigVoteResult(io: TypedServer, roomId: string, result: ConfigVoteResult): void {
  io.to(roomId).emit("room:voteConfigChangeResult", {
    passed: result.passed,
    gameId: result.selection.gameId,
    modeId: result.selection.modeId,
    configPatch: result.selection.config,
  });
}

function emitRoomUpdateAfterLeave(io: TypedServer, roomId: string, room: Room | undefined): void {
  if (!room) {
    return;
  }

  const voteResult = room.consumePendingConfigVoteResult();
  if (voteResult) {
    emitConfigVoteResult(io, roomId, voteResult);
  }

  if (room.playerCount > 0) {
    io.to(roomId).emit("room:updated", room.toRoomDetail());
  }
}

/**
 * 工厂函数：创建 Socket.IO 事件处理器。
 * 依赖注入，便于测试和替换。
 */
export function createHandlers(deps: HandlerDeps): (socket: TypedSocket) => void {
  const { io, roomManager, sessionManager, gameRegistry, matches } = deps;

  /** playerId → 断线超时定时器 */
  const disconnectTimers = new Map<string, NodeJS.Timeout>();

  function emitMatchSync(roomId: string, game: MatchEngine): void {
    const room = roomManager.getRoom(roomId);
    if (!room) {
      return;
    }

    for (const player of room.players) {
      const playerSession = sessionManager.getByToken(player.playerId);
      if (!playerSession?.socketId) {
        continue;
      }

      io.to(playerSession.socketId).emit("match:syncState", game.getFullState(player.playerId));
    }
  }

  function startMatchIfReady(roomId: string): boolean {
    const room = roomManager.getRoom(roomId);
    if (!room || room.status !== RoomStatus.Waiting || !room.allReady) {
      return false;
    }

    room.startPlaying();
    io.to(roomId).emit("room:updated", room.toRoomDetail());

    const gamePlayers = room.players.map((player) => ({
      playerId: player.playerId,
      playerName: player.playerName,
      playerType: player.playerType,
    }));

    const game = gameRegistry.createMatchEngine(roomId, gamePlayers, room.gameSelection);
    matches.set(roomId, game);
    io.to(roomId).emit("match:started");
    emitMatchSync(roomId, game);
    io.emit("room:listUpdated", roomManager.listRooms());
    return true;
  }

  let botController: BotController;

  function dispatchPlayerAction(roomId: string, action: MatchAction): { ok: boolean; error?: string } {
    const game = matches.get(roomId);
    if (!game) {
      return { ok: false, error: "娌℃湁杩涜涓殑娓告垙" };
    }

    switch (action.type) {
      case "callBid": {
        const result = game.dispatch(action);
        if (!result.ok) {
          return { ok: false, error: result.error };
        }

        emitMatchSync(roomId, game);
        return { ok: true };
      }

      case "playCards": {
        const result = game.dispatch(action);
        if (!result.ok) {
          return { ok: false, error: result.error };
        }

        if (result.gameEnd) {
          io.to(roomId).emit("match:ended", result.gameEnd);

          const room = roomManager.getRoom(roomId);
          if (room) {
            room.finishGame();
            room.backToWaiting();
          }

          matches.delete(roomId);
          botController.cancel(roomId);
          io.emit("room:listUpdated", roomManager.listRooms());
          return { ok: true };
        }

        emitMatchSync(roomId, game);
        return { ok: true };
      }

      case "pass": {
        const result = game.dispatch(action);
        if (!result.ok) {
          return { ok: false, error: result.error };
        }

        emitMatchSync(roomId, game);
        return { ok: true };
      }
    }
  }

  function createBotIdentity(roomId: string): { playerId: string; playerName: string } {
    const room = roomManager.getRoom(roomId);
    let botIndex = 1;

    while (room?.getPlayer(`bot:${roomId}:${botIndex}`)) {
      botIndex += 1;
    }

    return {
      playerId: `bot:${roomId}:${botIndex}`,
      playerName: `Bot ${botIndex}`,
    };
  }

  botController = new BotController({
    roomManager,
    matches,
    dispatchAction: dispatchPlayerAction,
  });
  return (socket: TypedSocket) => {
    const token = socket.handshake.auth.token as string | undefined;
    const playerName = socket.handshake.auth.playerName as string | undefined;

    if (!token || typeof token !== "string" || token.length > 100) {
      socket.emit("error", { message: "Invalid session token." });
      socket.disconnect(true);
      return;
    }

    if (!playerName || typeof playerName !== "string" || playerName.trim().length === 0 || playerName.length > 20) {
      socket.emit("error", { message: "Invalid player name." });
      socket.disconnect(true);
      return;
    }

    // ==================== 连接处理 ====================
    const existingSession = sessionManager.getByToken(token);

    if (existingSession && existingSession.disconnectedAt !== null) {
      // 重连
      const session = sessionManager.reconnect(token, socket.id);
      if (!session) {
        socket.emit("error", { message: "重连失败" });
        socket.disconnect(true);
        return;
      }

      // 清除断线定时器
      const timer = disconnectTimers.get(session.playerId);
      if (timer) {
        clearTimeout(timer);
        disconnectTimers.delete(session.playerId);
      }

      // 如果在房间中，重新 join socket room
      if (session.roomId) {
        const room = roomManager.getRoom(session.roomId);
        if (room) {
          socket.join(session.roomId);
          room.setOnline(session.playerId, true);

          // 如果有进行中的游戏
          const game = matches.get(session.roomId);
          if (game && game.phase !== GamePhase.Ended) {
            game.setPlayerOnline(session.playerId, true);
            socket.emit("match:syncState", game.getFullState(session.playerId));
            io.to(session.roomId).emit("player:reconnected", {
              playerId: session.playerId,
            });
          } else {
            // 没有游戏，也通知房间内其他人
            io.to(session.roomId).emit("player:reconnected", {
              playerId: session.playerId,
            });
            io.to(session.roomId).emit("room:updated", room.toRoomDetail());
          }
        }
      }

      console.log(`[reconnected] ${session.playerName} (${token})`);
    } else {
      // 新连接注册（或刷新浏览器 — session 存在但未断线）
      sessionManager.register(token, socket.id, playerName);

      // S2: 刷新浏览器时，session 可能已有 roomId，需重新加入 socket room
      const session = sessionManager.getByToken(token);
      if (session?.roomId) {
        const room = roomManager.getRoom(session.roomId);
        if (room) {
          socket.join(session.roomId);
          room.setOnline(session.playerId, true);

          const game = matches.get(session.roomId);
          if (game && game.phase !== GamePhase.Ended) {
            game.setPlayerOnline(session.playerId, true);
            socket.emit("match:syncState", game.getFullState(session.playerId));
          } else {
            io.to(session.roomId).emit("room:updated", room.toRoomDetail());
          }
        }
      }

      console.log(`[connected] ${playerName} (${token})`);
    }

    // ==================== room:create ====================
    socket.on("room:create", (data, callback) => {
      const session = sessionManager.getBySocketId(socket.id);
      if (!session) {
        callback({ ok: false, error: "Invalid session." });
        return;
      }

      if (session.roomId) {
        callback({ ok: false, error: "你已经在一个房间中" });
        return;
      }

      const roomName = typeof data.roomName === "string" ? data.roomName.trim().slice(0, 20) : "";
      if (!roomName) {
        callback({ ok: false, error: "Room name is required." });
        return;
      }

      const selection = resolveSelection(data.gameId, data.modeId, data.config);
      if (!selection) {
        callback({ ok: false, error: "Unsupported game or mode." });
        return;
      }

      const room = roomManager.createRoom(roomName, session.playerId, session.playerName, selection);
      session.roomId = room.roomId;
      socket.join(room.roomId);
      io.emit("room:listUpdated", roomManager.listRooms());
      callback({ ok: true, roomId: room.roomId });
    });

    // ==================== room:join ====================
    socket.on("room:join", (data, callback) => {
      const session = sessionManager.getBySocketId(socket.id);
      if (!session) {
        callback({ ok: false, error: "Invalid session." });
        return;
      }

      if (session.roomId) {
        callback({ ok: false, error: "Already in a room." });
        return;
      }

      const result = roomManager.joinRoom(data.roomId, session.playerId, session.playerName);
      if (!result.ok) {
        callback({ ok: false, error: result.error });
        return;
      }

      session.roomId = data.roomId;
      socket.join(data.roomId);
      io.to(data.roomId).emit("room:updated", result.room.toRoomDetail());
      io.emit("room:listUpdated", roomManager.listRooms());
      callback({ ok: true });
    });

    // ==================== room:addBot ====================
    socket.on("room:addBot", (callback) => {
      const session = sessionManager.getBySocketId(socket.id);
      if (!session || !session.roomId) {
        callback({ ok: false, error: "Not in a room." });
        return;
      }

      const room = roomManager.getRoom(session.roomId);
      if (!room) {
        callback({ ok: false, error: "Room does not exist." });
        return;
      }

      const botIdentity = createBotIdentity(session.roomId);
      const result = roomManager.addBot(session.roomId, botIdentity.playerId, botIdentity.playerName);
      if (!result.ok) {
        callback({ ok: false, error: result.error });
        return;
      }

      io.to(session.roomId).emit("room:updated", result.room.toRoomDetail());
      io.emit("room:listUpdated", roomManager.listRooms());
      callback({ ok: true, playerId: botIdentity.playerId });

      if (startMatchIfReady(session.roomId)) {
        botController.scheduleIfNeeded(session.roomId);
      }
    });

    // ==================== room:removeBot ====================
    socket.on("room:removeBot", (data, callback) => {
      const session = sessionManager.getBySocketId(socket.id);
      if (!session || !session.roomId) {
        callback({ ok: false, error: "Not in a room." });
        return;
      }

      const result = roomManager.removeBot(session.roomId, data.playerId);
      if (!result.ok) {
        callback({ ok: false, error: result.error });
        return;
      }

      io.to(session.roomId).emit("room:updated", result.room.toRoomDetail());
      io.emit("room:listUpdated", roomManager.listRooms());
      callback({ ok: true });
    });

    // ==================== room:leave ====================
    socket.on("room:leave", () => {
      const session = sessionManager.getBySocketId(socket.id);
      if (!session || !session.roomId) return;

      const roomId = session.roomId;
      const playerId = session.playerId;

      // R5: 清除该玩家的断线计时器
      const existingTimer = disconnectTimers.get(playerId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        disconnectTimers.delete(playerId);
      }

      // 如果正在游戏中 → 立即判负
      const game = matches.get(roomId);
      if (game && game.phase !== GamePhase.Ended) {
        const endResult = game.handleDisconnectTimeout(playerId);
        if (endResult) {
          // R3: 先向离开者发送结算，再让其离开 socket room
          socket.emit("match:ended", endResult);
          io.to(roomId).emit("match:ended", endResult);
        }
        matches.delete(roomId);

        const room = roomManager.getRoom(roomId);
        if (room) {
          room.finishGame();
          room.backToWaiting();
        }
      }

      // R3: 在发送完所有事件后再离开 socket room
      socket.leave(roomId);

      // 离开房间
      botController.cancel(roomId);
      const room = roomManager.leaveRoom(roomId, playerId);
      session.roomId = null;

      emitRoomUpdateAfterLeave(io, roomId, room);
      io.emit("room:listUpdated", roomManager.listRooms());
    });

    // ==================== room:list ====================
    socket.on("room:list", (callback) => {
      callback(roomManager.listRooms());
    });

    // ==================== room:requestSync ====================
    socket.on("room:requestSync", (callback) => {
      const session = sessionManager.getBySocketId(socket.id);
      if (!session || !session.roomId) {
        callback({ ok: false, error: "Not in a room." });
        return;
      }

      const room = roomManager.getRoom(session.roomId);
      if (!room) {
        callback({ ok: false, error: "Room does not exist." });
        return;
      }

      callback({ ok: true, room: room.toRoomDetail() });
    });


    // ==================== match:ready ====================
    socket.on("match:ready", () => {
      const session = sessionManager.getBySocketId(socket.id);
      if (!session || !session.roomId) {
        socket.emit("error", { message: "Not in a room." });
        return;
      }

      const room = roomManager.getRoom(session.roomId);
      if (!room) {
        socket.emit("error", { message: "Room does not exist." });
        return;
      }

      if (room.status !== RoomStatus.Waiting) {
        socket.emit("error", { message: "Room is not waiting for ready state." });
        return;
      }

      room.setReady(session.playerId, true);
      io.to(session.roomId).emit("room:updated", room.toRoomDetail());

      if (!startMatchIfReady(session.roomId)) {
        return;
      }

      botController.scheduleIfNeeded(session.roomId);
    });

    socket.on("match:action", (data: MatchActionData, callback) => {
      const session = sessionManager.getBySocketId(socket.id);
      if (!session || !session.roomId) {
        callback({ ok: false, error: "Not in a room." });
        return;
      }

      const game = matches.get(session.roomId);
      if (!game) {
        callback({ ok: false, error: "没有进行中的游戏" });
        return;
      }

      switch (data.type) {
        case "callBid": {
          if (![0, 1, 2, 3].includes(data.bid)) {
            callback({ ok: false, error: "Invalid bid." });
            return;
          }

          const result = dispatchPlayerAction(session.roomId, {
            type: "callBid",
            playerId: session.playerId,
            bid: data.bid,
          });
          if (!result.ok) {
            callback({ ok: false, error: result.error });
            return;
          }

          callback({ ok: true });
          botController.scheduleIfNeeded(session.roomId);
          return;
        }

        case "playCards": {
          if (
            !Array.isArray(data.cards) ||
            data.cards.some(
              (card: unknown) =>
                typeof card !== "object" || card === null ||
                !("rank" in card) || !("suit" in card),
            )
          ) {
            callback({ ok: false, error: "Invalid cards." });
            return;
          }

          const result = dispatchPlayerAction(session.roomId, {
            type: "playCards",
            playerId: session.playerId,
            cards: data.cards,
          });
          if (!result.ok) {
            callback({ ok: false, error: result.error });
            return;
          }

          callback({ ok: true });
          botController.scheduleIfNeeded(session.roomId);
          return;
        }

        case "pass": {
          const result = dispatchPlayerAction(session.roomId, {
            type: "pass",
            playerId: session.playerId,
          });
          if (!result.ok) {
            callback({ ok: false, error: result.error });
            return;
          }

          callback({ ok: true });
          botController.scheduleIfNeeded(session.roomId);
          return;
        }
      }
    });

    // ==================== match:requestSync ====================
    socket.on("match:requestSync", () => {
      const session = sessionManager.getBySocketId(socket.id);
      if (!session || !session.roomId) {
        socket.emit("error", { message: "Not in a room." });
        return;
      }

      const game = matches.get(session.roomId);
      if (!game) {
        socket.emit("error", { message: "没有进行中的游戏" });
        return;
      }

      socket.emit("match:syncState", game.getFullState(session.playerId));
    });

    // ==================== room:voteConfigChange ====================
    socket.on("room:voteConfigChange", (data, callback) => {
      const session = sessionManager.getBySocketId(socket.id);
      if (!session || !session.roomId) {
        callback({ ok: false, error: "Not in a room." });
        return;
      }

      const room = roomManager.getRoom(session.roomId);
      if (!room) {
        callback({ ok: false, error: "Room does not exist." });
        return;
      }

      if (room.status !== RoomStatus.Waiting && room.status !== RoomStatus.Finished) {
        callback({ ok: false, error: "Cannot change config while the room is playing." });
        return;
      }

      const selection = resolveSelectionFromPatch(room.gameSelection, data);
      if (!selection) {
        callback({ ok: false, error: "Unsupported game or mode." });
        return;
      }

      const result = room.startConfigVote(session.playerId, selection);
      if (!result.ok) {
        callback({ ok: false, error: result.error });
        return;
      }

      if (result.status === "started") {
        io.to(session.roomId).emit("room:voteConfigChangeStarted", {
          initiator: session.playerId,
          gameId: data.gameId,
          modeId: data.modeId,
          configPatch: data.configPatch,
        });
      } else {
        emitConfigVoteResult(io, session.roomId, result.result);
        if (result.result.passed) {
          io.to(session.roomId).emit("room:updated", room.toRoomDetail());
        }
      }
      callback({ ok: true });
    });

    // ==================== room:voteConfigChangeVote ====================
    socket.on("room:voteConfigChangeVote", (data, callback) => {
      const session = sessionManager.getBySocketId(socket.id);
      if (!session || !session.roomId) {
        callback({ ok: false, error: "Not in a room." });
        return;
      }

      const room = roomManager.getRoom(session.roomId);
      if (!room) {
        callback({ ok: false, error: "Room does not exist." });
        return;
      }

      const result = room.castConfigVote(session.playerId, data.agree);
      if (!result.ok) {
        callback({ ok: false, error: result.error });
        return;
      }

      if (result.result) {
        io.to(session.roomId).emit("room:voteConfigChangeResult", {
          passed: result.result.passed,
          gameId: result.result.selection.gameId,
          modeId: result.result.selection.modeId,
          configPatch: result.result.selection.config,
        });
        if (result.result.passed) {
          io.to(session.roomId).emit("room:updated", room.toRoomDetail());
        }
      }

      callback({ ok: true });
    });

    // ==================== disconnect ====================
    socket.on("disconnect", () => {
      const session = sessionManager.disconnect(socket.id);
      if (!session) return;

      console.log(`[disconnected] ${session.playerName} (${session.playerId})`);

      // 先清除此玩家已有的断线定时器（避免重复）
      const existingTimer = disconnectTimers.get(session.playerId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        disconnectTimers.delete(session.playerId);
      }

      const roomId = session.roomId;
      if (!roomId) return;

      const room = roomManager.getRoom(roomId);
      if (!room) return;

      const game = matches.get(roomId);

      if (game && game.phase !== GamePhase.Ended) {
        // 在游戏中 → 标记离线，广播断线，设定超时
        game.setPlayerOnline(session.playerId, false);
        room.setOnline(session.playerId, false);
        io.to(roomId).emit("player:disconnected", {
          playerId: session.playerId,
        });

        const timer = setTimeout(() => {
          disconnectTimers.delete(session.playerId);

          // 检查是否仍然断线
          const currentSession = sessionManager.getByToken(session.playerId);
          if (currentSession && currentSession.socketId !== null) {
            // 已经重连了，不处理
            return;
          }

          // S1: 检查 game 引用是否仍然有效（可能已被其他逻辑销毁/替换）
          if (matches.get(roomId) !== game) {
            return;
          }

          // 超时判负
          const endResult = game.handleDisconnectTimeout(session.playerId);
          if (endResult) {
            io.to(roomId).emit("match:ended", endResult);
          }
          matches.delete(roomId);

          // S1: 仅当 session 仍属于此房间时才清除 roomId
          if (currentSession && currentSession.roomId === roomId) {
            currentSession.roomId = null;
          }

          const currentRoom = roomManager.getRoom(roomId);
          if (currentRoom) {
            currentRoom.finishGame();
            currentRoom.backToWaiting();
            botController.cancel(roomId);
            const remainingRoom = roomManager.leaveRoom(roomId, session.playerId);
            emitRoomUpdateAfterLeave(io, roomId, remainingRoom);
          }
          io.emit("room:listUpdated", roomManager.listRooms());
        }, DISCONNECT_TIMEOUT_MS);

        disconnectTimers.set(session.playerId, timer);
      } else {
        // 不在游戏中 → 直接离开房间
        room.setOnline(session.playerId, false);
        botController.cancel(roomId);
        const remainingRoom = roomManager.leaveRoom(roomId, session.playerId);
        session.roomId = null;

        emitRoomUpdateAfterLeave(io, roomId, remainingRoom);
        io.emit("room:listUpdated", roomManager.listRooms());
      }
    });
  };
}
