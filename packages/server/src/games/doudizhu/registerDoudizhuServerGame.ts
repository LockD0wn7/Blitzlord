import {
  getGameDefinition,
  registerGame,
} from "@blitzlord/shared";
import { doudizhuDefinition } from "@blitzlord/shared/games/doudizhu";
import type { ServerGameRegistry } from "../../platform/GameRegistry.js";
import { DoudizhuMatchRuntime } from "./DoudizhuMatchRuntime.js";

function ensureDoudizhuDefinitionRegistered(): void {
  if (!getGameDefinition(doudizhuDefinition.gameId)) {
    registerGame(doudizhuDefinition);
  }
}

export function registerDoudizhuServerGame(registry: ServerGameRegistry): void {
  ensureDoudizhuDefinitionRegistered();

  registry.registerGame({
    gameId: doudizhuDefinition.gameId,
    createRuntime: (roomId, players, selection) =>
      new DoudizhuMatchRuntime(roomId, players, selection),
  });
}
