import type { ServerGameRegistry } from "../platform/GameRegistry.js";
import { registerDoudizhuServerGame } from "./doudizhu/registerDoudizhuServerGame.js";

export function registerBuiltInServerGames(registry: ServerGameRegistry): void {
  registerDoudizhuServerGame(registry);
}
