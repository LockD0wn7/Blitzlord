import { describe, expect, it } from "vitest";
import { getPlayableHints } from "../games/doudizhu/index.js";
import { CardType, Rank, Suit } from "../types/card.js";
import type { Card, CardPlay } from "../types/card.js";

function c(rank: Rank, suit: Suit | null = Suit.Spade): Card {
  return { rank, suit };
}

function play(
  type: CardType,
  mainRank: Rank,
  cards: Card[],
  length?: number,
  extra?: Partial<CardPlay>,
): CardPlay {
  return { type, mainRank, cards, length, ...extra };
}

/** 提取提示的 type + mainRank + length 方便断言 */
function summarize(hints: CardPlay[]) {
  return hints.map((h) => ({
    type: h.type,
    mainRank: h.mainRank,
    length: h.length,
  }));
}

/** 检查是否包含某个提示 */
function hasHint(
  hints: CardPlay[],
  type: CardType,
  mainRank: Rank,
  length?: number,
): boolean {
  return hints.some(
    (h) =>
      h.type === type &&
      h.mainRank === mainRank &&
      (length === undefined || h.length === length),
  );
}

describe("getPlayableHints 赖子模式", () => {
  // ────────────────────────────────────
  // 向后兼容
  // ────────────────────────────────────
  it("无赖子模式时行为不变（wildcardRank 为 undefined）", () => {
    const hand = [
      c(Rank.Three, Suit.Spade),
      c(Rank.Three, Suit.Heart),
      c(Rank.Four, Suit.Spade),
    ];
    const withoutWild = getPlayableHints(hand, null);
    const withNullWild = getPlayableHints(hand, null, null);
    const withUndefinedWild = getPlayableHints(hand, null, undefined);

    // 三种调用方式结果相同
    expect(summarize(withoutWild)).toEqual(summarize(withNullWild));
    expect(summarize(withoutWild)).toEqual(summarize(withUndefinedWild));
  });

  // ────────────────────────────────────
  // 赖子 + 单牌组合对子
  // ────────────────────────────────────
  it("赖子可以和其他牌组成对子", () => {
    // 手牌：♠5 + 一张赖子(7)，赖子 rank = 7
    const hand = [
      c(Rank.Five, Suit.Spade),
      c(Rank.Seven, Suit.Heart), // 赖子
    ];
    const hints = getPlayableHints(hand, null, Rank.Seven);

    // 应该包含：以 5 为对子（5 + 赖子变 5），以 7 为对子（赖子保持原 rank）
    expect(hasHint(hints, CardType.Pair, Rank.Five)).toBe(true);
    // 赖子作为原始 rank 7 + 赖子，但只有一张赖子，单张赖子不能凑对子7
    // 除非用另一张赖子。这里只有 1 张赖子 + 1 张 5，对子 5 是可以的
  });

  // ────────────────────────────────────
  // 自由出牌时枚举所有赖子组合
  // ────────────────────────────────────
  it("自由出牌时枚举所有赖子组合", () => {
    // 手牌：♠3 ♥3 + 一张赖子(8)
    const hand = [
      c(Rank.Three, Suit.Spade),
      c(Rank.Three, Suit.Heart),
      c(Rank.Eight, Suit.Club), // 赖子
    ];
    const hints = getPlayableHints(hand, null, Rank.Eight);

    // 单牌：3, 8(赖子作为本身)
    expect(hasHint(hints, CardType.Single, Rank.Three)).toBe(true);
    expect(hasHint(hints, CardType.Single, Rank.Eight)).toBe(true);

    // 对子：33（自然对子）
    expect(hasHint(hints, CardType.Pair, Rank.Three)).toBe(true);

    // 三条：333（2 个自然 3 + 赖子变 3）
    expect(hasHint(hints, CardType.Triple, Rank.Three)).toBe(true);
  });

  // ────────────────────────────────────
  // 赖子模式下含 2 的顺子可被提示
  // ────────────────────────────────────
  it("赖子模式下含 2 的顺子可被提示", () => {
    // 手牌：10 J Q K A 2，赖子=3（不参与）
    // 在赖子模式下使用 WILDCARD_SEQUENCE_RANKS，2 可以参与顺子
    const hand = [
      c(Rank.Ten, Suit.Spade),
      c(Rank.Jack, Suit.Spade),
      c(Rank.Queen, Suit.Spade),
      c(Rank.King, Suit.Spade),
      c(Rank.Ace, Suit.Spade),
      c(Rank.Two, Suit.Spade),
    ];
    const hints = getPlayableHints(hand, null, Rank.Three);

    // 应该包含 10-J-Q-K-A 和 10-J-Q-K-A-2 的顺子
    expect(hasHint(hints, CardType.Straight, Rank.Ten, 5)).toBe(true);
    expect(hasHint(hints, CardType.Straight, Rank.Ten, 6)).toBe(true);
  });

  // ────────────────────────────────────
  // 4 张赖子产生纯赖子炸提示
  // ────────────────────────────────────
  it("4 张赖子产生纯赖子炸提示", () => {
    const hand = [
      c(Rank.Seven, Suit.Spade),
      c(Rank.Seven, Suit.Heart),
      c(Rank.Seven, Suit.Diamond),
      c(Rank.Seven, Suit.Club),
      c(Rank.Three, Suit.Spade),
    ];
    const hints = getPlayableHints(hand, null, Rank.Seven);

    // 纯赖子炸
    const pureWildBombs = hints.filter(
      (h) => h.type === CardType.Bomb && h.pureWild,
    );
    expect(pureWildBombs.length).toBeGreaterThanOrEqual(1);
  });

  // ────────────────────────────────────
  // 赖子 + 三条产生软炸提示
  // ────────────────────────────────────
  it("赖子 + 三条产生软炸提示", () => {
    // 手牌：♠5 ♥5 ♦5 + 一张赖子(8)
    const hand = [
      c(Rank.Five, Suit.Spade),
      c(Rank.Five, Suit.Heart),
      c(Rank.Five, Suit.Diamond),
      c(Rank.Eight, Suit.Club), // 赖子
    ];
    const hints = getPlayableHints(hand, null, Rank.Eight);

    // 三条5 + 赖子变5 = 软炸5
    const softBombs = hints.filter(
      (h) => h.type === CardType.Bomb && h.softBomb,
    );
    expect(softBombs.length).toBeGreaterThanOrEqual(1);
    expect(softBombs.some((h) => h.mainRank === Rank.Five)).toBe(true);
  });

  // ────────────────────────────────────
  // 压牌时只返回能压过的提示
  // ────────────────────────────────────
  it("压牌时只返回能压过的提示", () => {
    // 手牌：♠3 + 赖子(7)
    const hand = [
      c(Rank.Three, Suit.Spade),
      c(Rank.Seven, Suit.Heart), // 赖子
    ];

    // 上家出了对 5
    const prev = play(CardType.Pair, Rank.Five, [
      c(Rank.Five, Suit.Spade),
      c(Rank.Five, Suit.Heart),
    ]);

    const hints = getPlayableHints(hand, prev, Rank.Seven);

    // 对3（3+赖子变3）mainRank=3 打不过对5
    // 对7（赖子作为7+赖子变7），只有1张赖子不够凑对7
    // 所以应该有对 X，X>5 的提示，比如对6, 对8, ...
    // 实际上 3+赖子 只能组成：对3, 对7（如果有2张赖子）
    // 这里只有1张赖子+1张3，只能对3，打不过对5
    // 所以没有合法提示
    const pairHints = hints.filter((h) => h.type === CardType.Pair);
    expect(pairHints.length).toBe(0);
  });

  it("压牌时赖子组合能压过时返回提示", () => {
    // 手牌：♠8 + 赖子(7)
    const hand = [
      c(Rank.Eight, Suit.Spade),
      c(Rank.Seven, Suit.Heart), // 赖子
    ];

    // 上家出了对 5
    const prev = play(CardType.Pair, Rank.Five, [
      c(Rank.Five, Suit.Spade),
      c(Rank.Five, Suit.Heart),
    ]);

    const hints = getPlayableHints(hand, prev, Rank.Seven);

    // 8 + 赖子变 8 = 对 8，mainRank=8 > 5，可以打
    const pairHints = hints.filter((h) => h.type === CardType.Pair);
    expect(pairHints.length).toBeGreaterThanOrEqual(1);
    expect(pairHints.some((h) => h.mainRank === Rank.Eight)).toBe(true);
  });

  // ────────────────────────────────────
  // 赖子同时产生原始点数和万能牌牌型
  // ────────────────────────────────────
  it("赖子同时产生原始点数和万能牌牌型", () => {
    // 手牌：♠5 ♥5 + 赖子(8) + ♠9
    const hand = [
      c(Rank.Five, Suit.Spade),
      c(Rank.Five, Suit.Heart),
      c(Rank.Eight, Suit.Club), // 赖子
      c(Rank.Nine, Suit.Spade),
    ];
    const hints = getPlayableHints(hand, null, Rank.Eight);

    // 赖子作为原始 rank 8：单牌 8
    expect(hasHint(hints, CardType.Single, Rank.Eight)).toBe(true);

    // 赖子作为 5：三条 5
    expect(hasHint(hints, CardType.Triple, Rank.Five)).toBe(true);

    // 赖子作为 9：对子 9
    expect(hasHint(hints, CardType.Pair, Rank.Nine)).toBe(true);
  });

  // ────────────────────────────────────
  // 赖子填补顺子空缺
  // ────────────────────────────────────
  it("赖子填补顺子空缺", () => {
    // 手牌：3 4 6 7 + 赖子(8)，赖子变5可以凑 3-4-5-6-7
    const hand = [
      c(Rank.Three, Suit.Spade),
      c(Rank.Four, Suit.Spade),
      c(Rank.Six, Suit.Spade),
      c(Rank.Seven, Suit.Spade),
      c(Rank.Eight, Suit.Heart), // 赖子
    ];
    const hints = getPlayableHints(hand, null, Rank.Eight);

    expect(hasHint(hints, CardType.Straight, Rank.Three, 5)).toBe(true);
  });

  // ────────────────────────────────────
  // 赖子参与连对
  // ────────────────────────────────────
  it("赖子参与连对", () => {
    // 手牌：33 44 5 + 赖子(8)，赖子变5凑 33-44-55
    const hand = [
      c(Rank.Three, Suit.Spade),
      c(Rank.Three, Suit.Heart),
      c(Rank.Four, Suit.Spade),
      c(Rank.Four, Suit.Heart),
      c(Rank.Five, Suit.Spade),
      c(Rank.Eight, Suit.Club), // 赖子
    ];
    const hints = getPlayableHints(hand, null, Rank.Eight);

    expect(hasHint(hints, CardType.DoubleStraight, Rank.Three, 3)).toBe(true);
  });

  // ────────────────────────────────────
  // 赖子参与飞机
  // ────────────────────────────────────
  it("赖子参与飞机", () => {
    // 手牌：333 44 + 赖子(8)，赖子变4凑 333-444
    const hand = [
      c(Rank.Three, Suit.Spade),
      c(Rank.Three, Suit.Heart),
      c(Rank.Three, Suit.Diamond),
      c(Rank.Four, Suit.Spade),
      c(Rank.Four, Suit.Heart),
      c(Rank.Eight, Suit.Club), // 赖子
    ];
    const hints = getPlayableHints(hand, null, Rank.Eight);

    expect(hasHint(hints, CardType.TripleStraight, Rank.Three, 2)).toBe(true);
  });

  // ────────────────────────────────────
  // 2 张赖子凑对子
  // ────────────────────────────────────
  it("2 张赖子可以凑任意 rank 对子", () => {
    const hand = [
      c(Rank.Seven, Suit.Spade),  // 赖子
      c(Rank.Seven, Suit.Heart),  // 赖子
      c(Rank.Three, Suit.Spade),
    ];
    const hints = getPlayableHints(hand, null, Rank.Seven);

    // 两张赖子凑的对子 — 应该至少有赖子 rank 7 的对子
    expect(hasHint(hints, CardType.Pair, Rank.Seven)).toBe(true);
    // 还能凑对子 3（1自然3 + 1赖子变3）
    expect(hasHint(hints, CardType.Pair, Rank.Three)).toBe(true);
  });

  // ────────────────────────────────────
  // 火箭不受赖子影响
  // ────────────────────────────────────
  it("火箭不受赖子影响", () => {
    const hand = [
      c(Rank.BlackJoker, null),
      c(Rank.RedJoker, null),
      c(Rank.Seven, Suit.Spade), // 赖子
    ];
    const hints = getPlayableHints(hand, null, Rank.Seven);

    expect(hasHint(hints, CardType.Rocket, Rank.RedJoker)).toBe(true);
  });
});
