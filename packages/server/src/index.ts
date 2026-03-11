import { createServer } from "http";
import { Server } from "socket.io";
import type { ClientEvents, ServerEvents } from "@blitzlord/shared";
import { SessionManager } from "./session/SessionManager.js";
import { RoomManager } from "./room/RoomManager.js";
import { createServerGameRegistry } from "./platform/GameRegistry.js";
import { MatchEngine } from "./platform/MatchEngine.js";
import { createHandlers } from "./socket/handlers.js";

const httpServer = createServer();
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";
const io = new Server<ClientEvents, ServerEvents>(httpServer, {
  cors: { origin: corsOrigin, methods: ["GET", "POST"] },
});

const sessionManager = new SessionManager();
const roomManager = new RoomManager();
const gameRegistry = createServerGameRegistry();
const matches = new Map<string, MatchEngine>();

io.on("connection", createHandlers({
  io,
  roomManager,
  sessionManager,
  gameRegistry,
  matches,
}));

const PORT = parseInt(process.env.PORT || "3001", 10);
httpServer.listen(PORT, () => {
  console.log(`Blitzlord server listening on port ${PORT}`);
});
