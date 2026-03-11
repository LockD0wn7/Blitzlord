import type { ModeDefinition } from "../../../platform/index.js";
import {
  calculateScore,
  canBeat,
  getDisplayCardsForPlay,
  getPlayableHints,
  identifyCardType,
  validatePlay,
} from "../rules/index.js";
import type { DoudizhuModeConfig } from "../types.js";

export const wildcardMode: ModeDefinition<DoudizhuModeConfig> = {
  modeId: "wildcard",
  modeName: "赖子",
  defaultConfig: {
    wildcard: true,
  },
  ruleSet: {
    identifyPlay: identifyCardType,
    canBeat,
    getHints: getPlayableHints,
    validatePlay,
    scoreMatch: calculateScore,
    toDisplayState: getDisplayCardsForPlay,
  },
};
