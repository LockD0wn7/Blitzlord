import { describe, expect, it } from "vitest";
import { canBeat } from "../games/doudizhu/index.js";
import { CardType, Rank } from "../types/card.js";
import type { CardPlay } from "../types/card.js";

/** 快速构造 CardPlay，支持 softBomb / pureWild 标记 */
function play(
  type: CardType,
  mainRank: Rank,
  opts?: { softBomb?: boolean; pureWild?: boolean; length?: number },
): CardPlay {
  return {
    type,
    cards: [],
    mainRank,
    length: opts?.length,
    softBomb: opts?.softBomb,
    pureWild: opts?.pureWild,
  };
}

function hardBomb(rank: Rank): CardPlay {
  return play(CardType.Bomb, rank);
}

function softBomb(rank: Rank): CardPlay {
  return play(CardType.Bomb, rank, { softBomb: true });
}

function pureWildBomb(): CardPlay {
  return play(CardType.Bomb, Rank.Three, { pureWild: true });
}

function rocket(): CardPlay {
  return play(CardType.Rocket, Rank.RedJoker);
}

describe("canBeat - 赖子炸弹层级", () => {
  it("火箭 > 纯赖子炸", () => {
    expect(canBeat(rocket(), pureWildBomb())).toBe(true);
  });

  it("纯赖子炸 > 任何硬炸", () => {
    expect(canBeat(pureWildBomb(), hardBomb(Rank.Two))).toBe(true);
    expect(canBeat(pureWildBomb(), hardBomb(Rank.Ace))).toBe(true);
  });

  it("纯赖子炸 > 任何软炸", () => {
    expect(canBeat(pureWildBomb(), softBomb(Rank.Two))).toBe(true);
    expect(canBeat(pureWildBomb(), softBomb(Rank.Ace))).toBe(true);
  });

  it("硬炸 > 软炸（无论点数）", () => {
    expect(canBeat(hardBomb(Rank.Three), softBomb(Rank.Two))).toBe(true);
    expect(canBeat(hardBomb(Rank.Three), softBomb(Rank.Ace))).toBe(true);
  });

  it("硬炸 3 > 软炸 2（最小硬炸 > 最大软炸）", () => {
    expect(canBeat(hardBomb(Rank.Three), softBomb(Rank.Two))).toBe(true);
  });

  it("硬炸之间按点数比较", () => {
    expect(canBeat(hardBomb(Rank.Ace), hardBomb(Rank.King))).toBe(true);
    expect(canBeat(hardBomb(Rank.King), hardBomb(Rank.Ace))).toBe(false);
    expect(canBeat(hardBomb(Rank.Seven), hardBomb(Rank.Seven))).toBe(false);
  });

  it("软炸之间按点数比较", () => {
    expect(canBeat(softBomb(Rank.Ace), softBomb(Rank.King))).toBe(true);
    expect(canBeat(softBomb(Rank.King), softBomb(Rank.Ace))).toBe(false);
    expect(canBeat(softBomb(Rank.Seven), softBomb(Rank.Seven))).toBe(false);
  });

  it("软炸 > 非炸弹", () => {
    expect(canBeat(softBomb(Rank.Three), play(CardType.Single, Rank.Two))).toBe(true);
    expect(canBeat(softBomb(Rank.Three), play(CardType.Pair, Rank.Ace))).toBe(true);
  });

  it("硬炸 > 非炸弹", () => {
    expect(canBeat(hardBomb(Rank.Three), play(CardType.Single, Rank.Two))).toBe(true);
  });

  it("纯赖子炸不能压火箭", () => {
    expect(canBeat(pureWildBomb(), rocket())).toBe(false);
  });

  it("非炸弹之间原有逻辑不变", () => {
    // 同类型比 mainRank
    expect(canBeat(
      play(CardType.Single, Rank.Ace),
      play(CardType.Single, Rank.King),
    )).toBe(true);
    expect(canBeat(
      play(CardType.Single, Rank.King),
      play(CardType.Single, Rank.Ace),
    )).toBe(false);
    // 不同类型不能比
    expect(canBeat(
      play(CardType.Single, Rank.Two),
      play(CardType.Pair, Rank.Three),
    )).toBe(false);
  });

  it("软炸打不过硬炸（反向验证）", () => {
    expect(canBeat(softBomb(Rank.Two), hardBomb(Rank.Three))).toBe(false);
  });
});
