export interface PlayerSession {
  playerId: string; // = token
  socketId: string | null; // 当前 socket，断线时为 null
  playerName: string;
  roomId: string | null;
  disconnectedAt: number | null; // 断线时间戳
}

export class SessionManager {
  private byToken = new Map<string, PlayerSession>();
  private socketToToken = new Map<string, string>();

  register(
    token: string,
    socketId: string,
    playerName: string,
  ): PlayerSession {
    const existing = this.byToken.get(token);
    if (existing) {
      // 已有 session，更新 socket 映射
      if (existing.socketId) {
        this.socketToToken.delete(existing.socketId);
      }
      existing.socketId = socketId;
      existing.playerName = playerName;
      existing.disconnectedAt = null;
      this.socketToToken.set(socketId, token);
      return existing;
    }

    const session: PlayerSession = {
      playerId: token,
      socketId,
      playerName,
      roomId: null,
      disconnectedAt: null,
    };
    this.byToken.set(token, session);
    this.socketToToken.set(socketId, token);
    return session;
  }

  getByToken(token: string): PlayerSession | undefined {
    return this.byToken.get(token);
  }

  getBySocketId(socketId: string): PlayerSession | undefined {
    const token = this.socketToToken.get(socketId);
    if (!token) return undefined;
    return this.byToken.get(token);
  }

  /** 标记断线，返回断线的 session（用于后续超时检查） */
  disconnect(socketId: string): PlayerSession | undefined {
    const token = this.socketToToken.get(socketId);
    if (!token) return undefined;

    this.socketToToken.delete(socketId);
    const session = this.byToken.get(token);
    if (session) {
      session.socketId = null;
      session.disconnectedAt = Date.now();
    }
    return session;
  }

  /** 重连：用新 socketId 恢复已有 session */
  reconnect(token: string, newSocketId: string): PlayerSession | undefined {
    const session = this.byToken.get(token);
    if (!session) return undefined;

    // 清理旧 socket 映射（以防万一）
    if (session.socketId) {
      this.socketToToken.delete(session.socketId);
    }
    session.socketId = newSocketId;
    session.disconnectedAt = null;
    this.socketToToken.set(newSocketId, token);
    return session;
  }

  /** 获取所有已断线的 session（用于超时检查） */
  getDisconnectedSessions(): PlayerSession[] {
    const result: PlayerSession[] = [];
    for (const session of this.byToken.values()) {
      if (session.disconnectedAt !== null) {
        result.push(session);
      }
    }
    return result;
  }

  /** 完全移除一个 session */
  remove(token: string): void {
    const session = this.byToken.get(token);
    if (session?.socketId) {
      this.socketToToken.delete(session.socketId);
    }
    this.byToken.delete(token);
  }
}
