import { describe, expect, it } from "vitest";
import type { RuleSet } from "../index.js";
import {
  createGameRegistry,
  getGameDefinition,
  getModeDefinition,
  registerGame,
  resetGameRegistry,
} from "../index.js";

const dummyRuleSet: RuleSet = {};

describe("platform registry", () => {
  it("registers and resolves a game mode by gameId + modeId", () => {
    const registry = createGameRegistry();

    registry.registerGame({
      gameId: "doudizhu",
      gameName: "斗地主",
      modes: [
        {
          modeId: "classic",
          modeName: "经典",
          defaultConfig: {},
          ruleSet: dummyRuleSet,
        },
      ],
    });

    expect(registry.getGameDefinition("doudizhu")?.gameName).toBe("斗地主");
    expect(registry.getModeDefinition("doudizhu", "classic")?.modeName).toBe("经典");
    expect(registry.getModeDefinition("doudizhu", "wildcard")).toBeNull();
  });

  it("exposes the same operations from the shared default registry", () => {
    resetGameRegistry();

    registerGame({
      gameId: "test-game",
      gameName: "测试游戏",
      modes: [
        {
          modeId: "test-mode",
          modeName: "测试模式",
          defaultConfig: {},
          ruleSet: dummyRuleSet,
        },
      ],
    });

    expect(getGameDefinition("test-game")?.gameName).toBe("测试游戏");
    expect(getModeDefinition("test-game", "test-mode")?.modeName).toBe("测试模式");
  });

  it("clears the shared default registry", () => {
    resetGameRegistry();

    registerGame({
      gameId: "cleanup-game",
      gameName: "待清理游戏",
      modes: [
        {
          modeId: "cleanup-mode",
          modeName: "待清理模式",
          defaultConfig: {},
          ruleSet: dummyRuleSet,
        },
      ],
    });

    expect(getGameDefinition("cleanup-game")?.gameName).toBe("待清理游戏");

    resetGameRegistry();

    expect(getGameDefinition("cleanup-game")).toBeNull();
    expect(getModeDefinition("cleanup-game", "cleanup-mode")).toBeNull();
  });
});
