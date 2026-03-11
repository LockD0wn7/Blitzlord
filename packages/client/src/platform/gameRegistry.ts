import type { ComponentType } from "react";
import DoudizhuMatchView from "../games/doudizhu/DoudizhuMatchView";

export interface MatchViewProps {
  roomId: string;
}

export interface ClientRegisteredGame {
  gameId: string;
  gameName: string;
  MatchView: ComponentType<MatchViewProps>;
}

export interface ClientGameRegistryLike {
  getGame: (gameId: string) => ClientRegisteredGame | null;
}

export class ClientGameRegistry implements ClientGameRegistryLike {
  private readonly games = new Map<string, ClientRegisteredGame>();

  registerGame(game: ClientRegisteredGame): void {
    this.games.set(game.gameId, game);
  }

  getGame(gameId: string): ClientRegisteredGame | null {
    return this.games.get(gameId) ?? null;
  }
}

export function createClientGameRegistry(): ClientGameRegistry {
  const registry = new ClientGameRegistry();

  registry.registerGame({
    gameId: "doudizhu",
    gameName: "Doudizhu",
    MatchView: DoudizhuMatchView,
  });

  return registry;
}

export const clientGameRegistry = createClientGameRegistry();
