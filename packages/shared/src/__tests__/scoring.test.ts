import { describe, expect, it } from "vitest";
import { calculateScore, isSpring } from "../rules/scoring.js";

describe("calculateScore", () => {
  it("基础：1 分叫分，无炸弹，无火箭，无春天 → 1", () => {
    expect(calculateScore({ baseBid: 1, bombCount: 0, rocketUsed: false, isSpring: false })).toBe(1);
  });

  it("叫 3 分 → 3", () => {
    expect(calculateScore({ baseBid: 3, bombCount: 0, rocketUsed: false, isSpring: false })).toBe(3);
  });

  it("1 个炸弹 → ×2", () => {
    expect(calculateScore({ baseBid: 1, bombCount: 1, rocketUsed: false, isSpring: false })).toBe(2);
  });

  it("2 个炸弹 → ×4", () => {
    expect(calculateScore({ baseBid: 1, bombCount: 2, rocketUsed: false, isSpring: false })).toBe(4);
  });

  it("火箭 → ×2", () => {
    expect(calculateScore({ baseBid: 1, bombCount: 0, rocketUsed: true, isSpring: false })).toBe(2);
  });

  it("春天 → ×2", () => {
    expect(calculateScore({ baseBid: 1, bombCount: 0, rocketUsed: false, isSpring: true })).toBe(2);
  });

  it("全部倍率叠加：叫 3 分 + 2 炸弹 + 火箭 + 春天 → 3 × 4 × 2 × 2 = 48", () => {
    expect(calculateScore({ baseBid: 3, bombCount: 2, rocketUsed: true, isSpring: true })).toBe(48);
  });

  it("叫 2 分 + 1 炸弹 → 2 × 2 = 4", () => {
    expect(calculateScore({ baseBid: 2, bombCount: 1, rocketUsed: false, isSpring: false })).toBe(4);
  });
});

describe("isSpring", () => {
  // 地主春天
  it("两个农民都没出过牌 → 地主春天", () => {
    expect(isSpring(5, [0, 0])).toBe(true);
  });

  // 反春天
  it("地主只出过 1 手牌 → 反春天", () => {
    expect(isSpring(1, [8, 6])).toBe(true);
  });

  // 非春天
  it("正常游戏（地主出多手，农民也出了牌）→ 非春天", () => {
    expect(isSpring(5, [3, 4])).toBe(false);
  });

  it("一个农民出了牌，另一个没出 → 非春天（不满足地主春天条件）", () => {
    expect(isSpring(4, [0, 3])).toBe(false);
  });

  it("地主出了 2 手牌 → 非反春天", () => {
    expect(isSpring(2, [5, 3])).toBe(false);
  });
});
