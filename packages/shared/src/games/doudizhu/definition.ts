import type { GameDefinition } from "../../platform/index.js";
import { classicMode } from "./modes/classic.js";
import { wildcardMode } from "./modes/wildcard.js";
import type { DoudizhuModeConfig } from "./types.js";

export const doudizhuDefinition: GameDefinition<DoudizhuModeConfig> = {
  gameId: "doudizhu",
  gameName: "斗地主",
  modes: [classicMode, wildcardMode],
};
