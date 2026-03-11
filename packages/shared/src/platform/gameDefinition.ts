import type { ModeDefinition } from "./modeDefinition.js";
import type {
  MatchSnapshotBase,
  PlayerActionEnvelope,
} from "./matchTypes.js";

export interface GameDefinition<
  TConfig = unknown,
  TState = unknown,
  TAction extends PlayerActionEnvelope = PlayerActionEnvelope,
  TSnapshot extends MatchSnapshotBase = MatchSnapshotBase,
> {
  gameId: string;
  gameName: string;
  modes: readonly ModeDefinition<TConfig, TState, TAction, TSnapshot>[];
}
