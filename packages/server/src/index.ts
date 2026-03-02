import { createServer } from "http";
import { Server } from "socket.io";
import type { ClientEvents, ServerEvents } from "@blitzlord/shared";
import { SessionManager } from "./session/SessionManager.js";
import { RoomManager } from "./room/RoomManager.js";
import { GameManager } from "./game/GameManager.js";
import { createHandlers } from "./socket/handlers.js";

const httpServer = createServer();
const io = new Server<ClientEvents, ServerEvents>(httpServer, {
  cors: { origin: "http://localhost:5173", methods: ["GET", "POST"] },
});

const sessionManager = new SessionManager();
const roomManager = new RoomManager();
const games = new Map<string, GameManager>();

io.on("connection", createHandlers({ io, roomManager, sessionManager, games }));

const PORT = 3001;
httpServer.listen(PORT, () => {
  console.log(`Blitzlord server listening on port ${PORT}`);
});
