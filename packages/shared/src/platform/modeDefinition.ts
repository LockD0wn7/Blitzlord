import type { RuleSet } from "./ruleSet.js";
import type {
  MatchSnapshotBase,
  PlayerActionEnvelope,
} from "./matchTypes.js";

export interface ModeDefinition<
  TConfig = unknown,
  TState = unknown,
  TAction extends PlayerActionEnvelope = PlayerActionEnvelope,
  TSnapshot extends MatchSnapshotBase = MatchSnapshotBase,
> {
  modeId: string;
  modeName: string;
  defaultConfig: TConfig;
  ruleSet: RuleSet<TConfig, TState, TAction, TSnapshot>;
}
