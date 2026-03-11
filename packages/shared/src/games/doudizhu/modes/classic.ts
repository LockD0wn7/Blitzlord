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

export const classicMode: ModeDefinition<DoudizhuModeConfig> = {
  modeId: "classic",
  modeName: "经典",
  defaultConfig: {
    wildcard: false,
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
