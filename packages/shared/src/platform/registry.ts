import type { GameDefinition } from "./gameDefinition.js";
import type { ModeDefinition } from "./modeDefinition.js";
import type {
  MatchSnapshotBase,
  PlayerActionEnvelope,
} from "./matchTypes.js";

type AnyGameDefinition = GameDefinition<
  any,
  any,
  any,
  any
>;

type AnyModeDefinition = ModeDefinition<
  any,
  any,
  any,
  any
>;

export interface GameRegistry {
  registerGame: <
    TConfig = unknown,
    TState = unknown,
    TAction extends PlayerActionEnvelope = PlayerActionEnvelope,
    TSnapshot extends MatchSnapshotBase = MatchSnapshotBase,
  >(
    game: GameDefinition<TConfig, TState, TAction, TSnapshot>,
  ) => void;
  getGameDefinition: (gameId: string) => AnyGameDefinition | null;
  getModeDefinition: (gameId: string, modeId: string) => AnyModeDefinition | null;
  reset: () => void;
}

export function createGameRegistry(): GameRegistry {
  const games = new Map<string, AnyGameDefinition>();

  return {
    registerGame(game) {
      games.set(game.gameId, game);
    },
    getGameDefinition(gameId) {
      return games.get(gameId) ?? null;
    },
    getModeDefinition(gameId, modeId) {
      const game = games.get(gameId);
      if (!game) {
        return null;
      }

      return game.modes.find((mode) => mode.modeId === modeId) ?? null;
    },
    reset() {
      games.clear();
    },
  };
}

const defaultRegistry = createGameRegistry();

export const registerGame = defaultRegistry.registerGame;
export const getGameDefinition = defaultRegistry.getGameDefinition;
export const getModeDefinition = defaultRegistry.getModeDefinition;
export const resetGameRegistry = defaultRegistry.reset;
