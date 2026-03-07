import type { Server, Socket } from "socket.io";
import type { ClientEvents, ServerEvents } from "@blitzlord/shared";
import { DISCONNECT_TIMEOUT_MS, GamePhase, RoomStatus } from "@blitzlord/shared";
import { SessionManager } from "../session/SessionManager.js";
import { RoomManager } from "../room/RoomManager.js";
import { GameManager } from "../game/GameManager.js";

type TypedServer = Server<ClientEvents, ServerEvents>;
type TypedSocket = Socket<ClientEvents, ServerEvents>;

export interface HandlerDeps {
  io: TypedServer;
  roomManager: RoomManager;
  sessionManager: SessionManager;
  games: Map<string, GameManager>;
}

/**
 * 工厂函数：创建 Socket.IO 事件处理器。
 * 依赖注入，便于测试和替换。
 */
export function createHandlers(deps: HandlerDeps): (socket: TypedSocket) => void {
  const { io, roomManager, sessionManager, games } = deps;

  /** playerId → 断线超时定时器 */
  const disconnectTimers = new Map<string, NodeJS.Timeout>();

  return (socket: TypedSocket) => {
    const token = socket.handshake.auth.token as string | undefined;
    const playerName = socket.handshake.auth.playerName as string | undefined;

    if (!token || typeof token !== "string" || token.length > 100) {
      socket.emit("error", { message: "无效的身份 token" });
      socket.disconnect(true);
      return;
    }

    if (!playerName || typeof playerName !== "string" || playerName.trim().length === 0 || playerName.length > 20) {
      socket.emit("error", { message: "无效的玩家昵称" });
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
          const game = games.get(session.roomId);
          if (game && game.phase !== GamePhase.Ended) {
            game.setPlayerOnline(session.playerId, true);
            socket.emit("game:syncState", game.getFullState(session.playerId));
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

          const game = games.get(session.roomId);
          if (game && game.phase !== GamePhase.Ended) {
            game.setPlayerOnline(session.playerId, true);
            socket.emit("game:syncState", game.getFullState(session.playerId));
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
        callback({ ok: false, error: "未找到 session" });
        return;
      }

      if (session.roomId) {
        callback({ ok: false, error: "你已经在一个房间中" });
        return;
      }

      const roomName = typeof data.roomName === "string" ? data.roomName.trim().slice(0, 20) : "";
      if (!roomName) {
        callback({ ok: false, error: "房间名不能为空" });
        return;
      }

      const room = roomManager.createRoom(roomName, session.playerId, session.playerName);
      session.roomId = room.roomId;
      socket.join(room.roomId);
      io.emit("room:listUpdated", roomManager.listRooms());
      callback({ ok: true, roomId: room.roomId });
    });

    // ==================== room:join ====================
    socket.on("room:join", (data, callback) => {
      const session = sessionManager.getBySocketId(socket.id);
      if (!session) {
        callback({ ok: false, error: "未找到 session" });
        return;
      }

      if (session.roomId) {
        callback({ ok: false, error: "你已经在一个房间中" });
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
      const game = games.get(roomId);
      if (game && game.phase !== GamePhase.Ended) {
        const endResult = game.handleDisconnectTimeout(playerId);
        if (endResult) {
          // R3: 先向离开者发送结算，再让其离开 socket room
          socket.emit("game:ended", endResult);
          io.to(roomId).emit("game:ended", endResult);
        }
        games.delete(roomId);

        const room = roomManager.getRoom(roomId);
        if (room) {
          room.finishGame();
          room.backToWaiting();
        }
      }

      // R3: 在发送完所有事件后再离开 socket room
      socket.leave(roomId);

      // 离开房间
      const room = roomManager.leaveRoom(roomId, playerId);
      session.roomId = null;

      if (room) {
        // 如果房间还存在（还有其他人），通知更新
        if (room.playerCount > 0) {
          io.to(roomId).emit("room:updated", room.toRoomDetail());
        }
      }
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
        callback({ ok: false, error: "未在房间中" });
        return;
      }

      const room = roomManager.getRoom(session.roomId);
      if (!room) {
        callback({ ok: false, error: "房间不存在" });
        return;
      }

      callback({ ok: true, room: room.toRoomDetail() });
    });

    // ==================== game:ready ====================
    socket.on("game:ready", () => {
      const session = sessionManager.getBySocketId(socket.id);
      if (!session || !session.roomId) {
        socket.emit("error", { message: "未在房间中" });
        return;
      }

      const room = roomManager.getRoom(session.roomId);
      if (!room) {
        socket.emit("error", { message: "房间不存在" });
        return;
      }

      // R4: 只有在等待状态才能准备
      if (room.status !== RoomStatus.Waiting) {
        socket.emit("error", { message: "房间不在等待状态" });
        return;
      }

      room.setReady(session.playerId, true);
      io.to(session.roomId).emit("room:updated", room.toRoomDetail());

      // 如果全部准备好，开始游戏
      if (room.allReady) {
        room.startPlaying();

        const gamePlayers = room.players.map((p) => ({
          playerId: p.playerId,
          playerName: p.playerName,
        }));

        const game = new GameManager(session.roomId, gamePlayers);
        games.set(session.roomId, game);

        // 向每个玩家分别推送 game:started（各自手牌不同）
        const playersInfo = room.players.map((p) => ({
          playerId: p.playerId,
          playerName: p.playerName,
          seatIndex: p.seatIndex,
        }));

        for (const p of room.players) {
          const pSession = sessionManager.getByToken(p.playerId);
          if (pSession?.socketId) {
            io.to(pSession.socketId).emit("game:started", {
              hand: game.getPlayerHand(p.playerId),
              firstCaller: game.currentCallerId!,
              players: playersInfo,
            });
          }
        }

        io.emit("room:listUpdated", roomManager.listRooms());
      }
    });

    // ==================== game:callLandlord ====================
    socket.on("game:callLandlord", (data, callback) => {
      const session = sessionManager.getBySocketId(socket.id);
      if (!session || !session.roomId) {
        callback({ ok: false, error: "未在房间中" });
        return;
      }

      const game = games.get(session.roomId);
      if (!game) {
        callback({ ok: false, error: "没有进行中的游戏" });
        return;
      }

      // S5: 验证叫分值合法性
      if (![0, 1, 2, 3].includes(data.bid)) {
        callback({ ok: false, error: "无效的叫分值" });
        return;
      }

      const result = game.callBid(session.playerId, data.bid);
      if (!result.ok) {
        callback({ ok: false, error: result.error });
        return;
      }

      callback({ ok: true });

      const roomId = session.roomId;

      // 广播叫分更新
      io.to(roomId).emit("game:callUpdate", {
        playerId: session.playerId,
        bid: data.bid,
        nextCaller: result.nextCaller ?? null,
      });

      // 如果需要重新发牌
      if (result.redeal) {
        const room = roomManager.getRoom(roomId);
        if (room) {
          const playersInfo = room.players.map((p) => ({
            playerId: p.playerId,
            playerName: p.playerName,
            seatIndex: p.seatIndex,
          }));

          for (const p of room.players) {
            const pSession = sessionManager.getByToken(p.playerId);
            if (pSession?.socketId) {
              io.to(pSession.socketId).emit("game:started", {
                hand: game.getPlayerHand(p.playerId),
                firstCaller: game.currentCallerId!,
                players: playersInfo,
              });
            }
          }
        }
        return;
      }

      // 如果已确定地主
      if (result.landlord) {
        io.to(roomId).emit("game:landlordDecided", {
          landlordId: result.landlord.playerId,
          bottomCards: result.landlord.bottomCards,
          baseBid: result.landlord.baseBid,
          wildcardRank: null,
        });

        // 给地主推送完整状态（含底牌后的新手牌）
        const landlordSession = sessionManager.getByToken(result.landlord.playerId);
        if (landlordSession?.socketId) {
          io.to(landlordSession.socketId).emit(
            "game:syncState",
            game.getFullState(result.landlord.playerId),
          );
        }

        // 广播轮次
        if (game.currentTurn) {
          io.to(roomId).emit("game:turnChanged", {
            currentTurn: game.currentTurn,
          });
        }
      }
    });

    // ==================== game:playCards ====================
    socket.on("game:playCards", (data, callback) => {
      const session = sessionManager.getBySocketId(socket.id);
      if (!session || !session.roomId) {
        callback({ ok: false, error: "未在房间中" });
        return;
      }

      const game = games.get(session.roomId);
      if (!game) {
        callback({ ok: false, error: "没有进行中的游戏" });
        return;
      }

      // S6: 验证出牌数据格式
      if (
        !Array.isArray(data.cards) ||
        data.cards.some(
          (c: unknown) =>
            typeof c !== "object" || c === null ||
            !("rank" in c) || !("suit" in c),
        )
      ) {
        callback({ ok: false, error: "无效的出牌数据" });
        return;
      }

      const result = game.playCards(session.playerId, data.cards);
      if (!result.ok) {
        callback({ ok: false, error: result.error });
        return;
      }

      callback({ ok: true });

      const roomId = session.roomId;

      // 广播出牌
      io.to(roomId).emit("game:cardsPlayed", {
        playerId: session.playerId,
        play: result.play!,
        remainingCards: result.remainingCards!,
      });

      // 游戏结束
      if (result.gameEnd) {
        io.to(roomId).emit("game:ended", result.gameEnd);

        const room = roomManager.getRoom(roomId);
        if (room) {
          room.finishGame();
          room.backToWaiting();
        }
        games.delete(roomId);
        io.emit("room:listUpdated", roomManager.listRooms());
      } else {
        // 广播轮次切换
        if (game.currentTurn) {
          io.to(roomId).emit("game:turnChanged", {
            currentTurn: game.currentTurn,
          });
        }
      }
    });

    // ==================== game:pass ====================
    socket.on("game:pass", (callback) => {
      const session = sessionManager.getBySocketId(socket.id);
      if (!session || !session.roomId) {
        callback({ ok: false, error: "未在房间中" });
        return;
      }

      const game = games.get(session.roomId);
      if (!game) {
        callback({ ok: false, error: "没有进行中的游戏" });
        return;
      }

      const result = game.pass(session.playerId);
      if (!result.ok) {
        callback({ ok: false, error: result.error });
        return;
      }

      callback({ ok: true });

      const roomId = session.roomId;

      // 广播 pass
      io.to(roomId).emit("game:passed", {
        playerId: session.playerId,
        resetRound: result.resetRound ?? false,
      });

      // 广播轮次切换
      if (result.nextTurn) {
        io.to(roomId).emit("game:turnChanged", {
          currentTurn: result.nextTurn,
        });
      }
    });

    // ==================== game:requestSync ====================
    socket.on("game:requestSync", () => {
      const session = sessionManager.getBySocketId(socket.id);
      if (!session || !session.roomId) {
        socket.emit("error", { message: "未在房间中" });
        return;
      }

      const game = games.get(session.roomId);
      if (!game) {
        socket.emit("error", { message: "没有进行中的游戏" });
        return;
      }

      socket.emit("game:syncState", game.getFullState(session.playerId));
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

      const game = games.get(roomId);

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
          if (games.get(roomId) !== game) {
            return;
          }

          // 超时判负
          const endResult = game.handleDisconnectTimeout(session.playerId);
          if (endResult) {
            io.to(roomId).emit("game:ended", endResult);
          }
          games.delete(roomId);

          // S1: 仅当 session 仍属于此房间时才清除 roomId
          if (currentSession && currentSession.roomId === roomId) {
            currentSession.roomId = null;
          }

          const currentRoom = roomManager.getRoom(roomId);
          if (currentRoom) {
            currentRoom.finishGame();
            currentRoom.backToWaiting();
            // 移除断线玩家
            roomManager.leaveRoom(roomId, session.playerId);
            // R8: 断线超时后通知其他玩家房间状态更新
            if (currentRoom.playerCount > 0) {
              io.to(roomId).emit("room:updated", currentRoom.toRoomDetail());
            }
          }
          io.emit("room:listUpdated", roomManager.listRooms());
        }, DISCONNECT_TIMEOUT_MS);

        disconnectTimers.set(session.playerId, timer);
      } else {
        // 不在游戏中 → 直接离开房间
        room.setOnline(session.playerId, false);
        roomManager.leaveRoom(roomId, session.playerId);
        session.roomId = null;

        if (room.playerCount > 0) {
          io.to(roomId).emit("room:updated", room.toRoomDetail());
        }
        io.emit("room:listUpdated", roomManager.listRooms());
      }
    });
  };
}
