import { io, Socket } from "socket.io-client";
import type { ClientEvents, MatchActionData, ServerEvents } from "@blitzlord/shared";

type TypedSocket = Socket<ServerEvents, ClientEvents>;

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
    const options = {
      auth: { token, playerName: localStorage.getItem("playerName") || "玩家" },
      autoConnect: false,
      timeout: 60_000,
      reconnectionDelay: 2_000,
      reconnectionDelayMax: 10_000,
      reconnectionAttempts: 10,
    };

    socket = (SERVER_URL ? io(SERVER_URL, options) : io(options)) as TypedSocket;
  }

  return socket;
}

export function connectSocket(): void {
  const currentSocket = getSocket();
  const nextAuth = {
    token: getToken(),
    playerName: localStorage.getItem("playerName") || "玩家",
  };

  if (currentSocket.connected) {
    const currentAuth = currentSocket.auth as { token?: string; playerName?: string };
    if (currentAuth.playerName !== nextAuth.playerName || currentAuth.token !== nextAuth.token) {
      currentSocket.auth = nextAuth;
      currentSocket.disconnect();
      currentSocket.connect();
    }
    return;
  }

  currentSocket.auth = nextAuth;
  currentSocket.connect();
}

export function disconnectSocket(): void {
  socket?.disconnect();
}

export function emitVoteConfigChange(
  data: { gameId?: string; modeId?: string; configPatch?: Record<string, unknown> },
  cb: (res: { ok: boolean; error?: string }) => void,
): void {
  getSocket().emit("room:voteConfigChange", data, cb);
}

export function emitVoteConfigChangeVote(
  agree: boolean,
  cb: (res: { ok: boolean; error?: string }) => void,
): void {
  getSocket().emit("room:voteConfigChangeVote", { agree }, cb);
}

export function emitMatchReady(): void {
  getSocket().emit("match:ready");
}

export function emitMatchAction(
  data: MatchActionData,
  cb: (res: { ok: boolean; error?: string }) => void,
): void {
  getSocket().emit("match:action", data, cb);
}

export function emitMatchRequestSync(): void {
  getSocket().emit("match:requestSync");
}
