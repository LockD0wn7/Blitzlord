import { getModeDefinition } from "@blitzlord/shared";
import { registerBuiltInServerGames } from "../games/registerBuiltInServerGames.js";
import type { RoomGameSelection } from "../room/Room.js";
import { MatchEngine, type MatchRuntime } from "./MatchEngine.js";
import type { MatchPlayer } from "./types.js";

export interface ServerRegisteredGame {
  gameId: string;
  createRuntime: (
    roomId: string,
    players: MatchPlayer[],
    selection: RoomGameSelection,
  ) => MatchRuntime;
}

export class ServerGameRegistry {
  private readonly games = new Map<string, ServerRegisteredGame>();

  registerGame(game: ServerRegisteredGame): void {
    this.games.set(game.gameId, game);
  }

  getGame(gameId: string): ServerRegisteredGame | null {
    return this.games.get(gameId) ?? null;
  }

  createMatchEngine(
    roomId: string,
    players: MatchPlayer[],
    selection: RoomGameSelection,
  ): MatchEngine {
    const registeredGame = this.games.get(selection.gameId);
    if (!registeredGame) {
      throw new Error(`Unsupported game: ${selection.gameId}`);
    }

    const modeDefinition = getModeDefinition(selection.gameId, selection.modeId);
    if (!modeDefinition) {
      throw new Error(`Unsupported mode: ${selection.gameId}/${selection.modeId}`);
    }

    return new MatchEngine(
      registeredGame.createRuntime(roomId, players, selection),
    );
  }
}

export function createServerGameRegistry(): ServerGameRegistry {
  const registry = new ServerGameRegistry();
  registerBuiltInServerGames(registry);
  return registry;
}
