import type {
  MatchPlayer,
  MatchSnapshotBase,
  PlayerActionEnvelope,
} from "./matchTypes.js";

export interface RuleSet<
  TConfig = unknown,
  TState = unknown,
  TAction extends PlayerActionEnvelope = PlayerActionEnvelope,
  TSnapshot extends MatchSnapshotBase = MatchSnapshotBase,
> {
  setupMatch?: (params: {
    players: MatchPlayer[];
    config: TConfig;
  }) => TState;
  reduceAction?: (params: {
    state: TState;
    playerId: string;
    action: TAction;
  }) => TState;
  createSnapshot?: (params: {
    state: TState;
    playerId: string;
  }) => TSnapshot;
  identifyPlay?: (...args: any[]) => unknown;
  canBeat?: (...args: any[]) => boolean;
  getHints?: (...args: any[]) => unknown[];
  validatePlay?: (...args: any[]) => unknown;
  scoreMatch?: (...args: any[]) => unknown;
  toDisplayState?: (...args: any[]) => unknown;
}
