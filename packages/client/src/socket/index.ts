import { io, Socket } from "socket.io-client";
import type { ClientEvents, ServerEvents } from "@blitzlord/shared";

type TypedSocket = Socket<ServerEvents, ClientEvents>;

// 默认通过 Vite 代理（同源），也可通过环境变量直连服务端
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "";

function createFallbackPlayerId(): string {
  const bytes = new Uint8Array(16);
  const webCrypto = globalThis.crypto;

  if (webCrypto?.getRandomValues) {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

function createPlayerId(): string {
  const webCrypto = globalThis.crypto;
  if (webCrypto?.randomUUID) {
    return webCrypto.randomUUID();
  }
  return createFallbackPlayerId();
}

function getToken(): string {
  let token = localStorage.getItem("playerId");
  if (!token) {
    token = createPlayerId();
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
