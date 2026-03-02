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
    };
    socket = (SERVER_URL ? io(SERVER_URL, opts) : io(opts)) as TypedSocket;
  }
  return socket;
}

export function connectSocket(): void {
  const s = getSocket();
  if (!s.connected) {
    // 更新 auth 中的 playerName（可能已更改）
    s.auth = {
      token: getToken(),
      playerName: localStorage.getItem("playerName") || "玩家",
    };
    s.connect();
  }
}

export function disconnectSocket(): void {
  socket?.disconnect();
}
