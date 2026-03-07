import { io, Socket } from "socket.io-client";
import type { ClientEvents, ServerEvents } from "@blitzlord/shared";

type TypedSocket = Socket<ServerEvents, ClientEvents>;

// 默认通过 Vite 代理（同源），也可通过环境变量直连服务端
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "";

function getToken(): string {
  let token = localStorage.getItem("playerId");
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem("playerId", token);
  }
  return token;
}

let socket: TypedSocket | null = null;

export function getSocket(): TypedSocket {
  if (!socket) {
    const token = getToken();
    const opts = {
      auth: { token, playerName: localStorage.getItem("playerName") || "玩家" },
      autoConnect: false,
      // Render 免费实例冷启动需要 30-60 秒，增加超时
      timeout: 60_000,
      reconnectionDelay: 2_000,
      reconnectionDelayMax: 10_000,
      reconnectionAttempts: 10,
    };
    socket = (SERVER_URL ? io(SERVER_URL, opts) : io(opts)) as TypedSocket;
  }
  return socket;
}

export function connectSocket(): void {
  const s = getSocket();
  const newAuth = {
    token: getToken(),
    playerName: localStorage.getItem("playerName") || "玩家",
  };

  if (s.connected) {
    // R7: 即使已连接，也检查 auth 是否变化，变化则断开重连
    const currentAuth = s.auth as { token?: string; playerName?: string };
    if (
      currentAuth.playerName !== newAuth.playerName ||
      currentAuth.token !== newAuth.token
    ) {
      s.auth = newAuth;
      s.disconnect();
      s.connect();
    }
  } else {
    s.auth = newAuth;
    s.connect();
  }
}

export function disconnectSocket(): void {
  socket?.disconnect();
}

export function emitVoteMode(
  wildcard: boolean,
  cb: (res: { ok: boolean; error?: string }) => void,
): void {
  getSocket().emit("room:voteMode", { wildcard }, cb);
}

export function emitVoteModeVote(
  agree: boolean,
  cb: (res: { ok: boolean; error?: string }) => void,
): void {
  getSocket().emit("room:voteModeVote", { agree }, cb);
}
