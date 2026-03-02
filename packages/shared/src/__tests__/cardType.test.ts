import { describe, expect, it } from "vitest";
import { identifyCardType } from "../rules/cardType.js";
import { CardType, Rank, Suit } from "../types/card.js";
import type { Card } from "../types/card.js";

/** 快速创建牌的辅助函数 */
function c(rank: Rank, suit: Suit | null = Suit.Spade): Card {
  return { rank, suit };
}

describe("identifyCardType", () => {
  it("空牌返回 null", () => {
    expect(identifyCardType([])).toBeNull();
  });

  // 火箭
  it("识别火箭（大小王）", () => {
    const cards = [c(Rank.BlackJoker, null), c(Rank.RedJoker, null)];
    const result = identifyCardType(cards);
    expect(result).not.toBeNull();
    expect(result!.type).toBe(CardType.Rocket);
    expect(result!.mainRank).toBe(Rank.RedJoker);
  });

  // 单张
  it("识别单张", () => {
    const result = identifyCardType([c(Rank.Ace)]);
    expect(result).not.toBeNull();
    expect(result!.type).toBe(CardType.Single);
    expect(result!.mainRank).toBe(Rank.Ace);
  });

  // 对子
  it("识别对子", () => {
    const result = identifyCardType([c(Rank.King, Suit.Spade), c(Rank.King, Suit.Heart)]);
    expect(result).not.toBeNull();
    expect(result!.type).toBe(CardType.Pair);
    expect(result!.mainRank).toBe(Rank.King);
  });

  // 炸弹
  it("识别炸弹（4 张相同）", () => {
    const cards = [
      c(Rank.Seven, Suit.Spade),
      c(Rank.Seven, Suit.Heart),
      c(Rank.Seven, Suit.Diamond),
      c(Rank.Seven, Suit.Club),
    ];
    const result = identifyCardType(cards);
    expect(result).not.toBeNull();
    expect(result!.type).toBe(CardType.Bomb);
    expect(result!.mainRank).toBe(Rank.Seven);
  });

  // 三张
  it("识别三张", () => {
    const cards = [
      c(Rank.Ten, Suit.Spade),
      c(Rank.Ten, Suit.Heart),
      c(Rank.Ten, Suit.Diamond),
    ];
    const result = identifyCardType(cards);
    expect(result).not.toBeNull();
    expect(result!.type).toBe(CardType.Triple);
    expect(result!.mainRank).toBe(Rank.Ten);
  });

  // 三带一
  it("识别三带一", () => {
    const cards = [
      c(Rank.Jack, Suit.Spade),
      c(Rank.Jack, Suit.Heart),
      c(Rank.Jack, Suit.Diamond),
      c(Rank.Three),
    ];
    const result = identifyCardType(cards);
    expect(result).not.toBeNull();
    expect(result!.type).toBe(CardType.TripleWithOne);
    expect(result!.mainRank).toBe(Rank.Jack);
  });

  // 三带二
  it("识别三带二（带一对）", () => {
    const cards = [
      c(Rank.Queen, Suit.Spade),
      c(Rank.Queen, Suit.Heart),
      c(Rank.Queen, Suit.Diamond),
      c(Rank.Four, Suit.Spade),
      c(Rank.Four, Suit.Heart),
    ];
    const result = identifyCardType(cards);
    expect(result).not.toBeNull();
    expect(result!.type).toBe(CardType.TripleWithPair);
    expect(result!.mainRank).toBe(Rank.Queen);
  });

  // 顺子
  it("识别顺子（5 张）", () => {
    const cards = [
      c(Rank.Three),
      c(Rank.Four),
      c(Rank.Five),
      c(Rank.Six),
      c(Rank.Seven),
    ];
    const result = identifyCardType(cards);
    expect(result).not.toBeNull();
    expect(result!.type).toBe(CardType.Straight);
    expect(result!.mainRank).toBe(Rank.Three);
    expect(result!.length).toBe(5);
  });

  it("识别顺子（12 张，3~A）", () => {
    const cards = [
      c(Rank.Three), c(Rank.Four), c(Rank.Five), c(Rank.Six),
      c(Rank.Seven), c(Rank.Eight), c(Rank.Nine), c(Rank.Ten),
      c(Rank.Jack), c(Rank.Queen), c(Rank.King), c(Rank.Ace),
    ];
    const result = identifyCardType(cards);
    expect(result).not.toBeNull();
    expect(result!.type).toBe(CardType.Straight);
    expect(result!.length).toBe(12);
  });

  it("含 2 的顺子无效", () => {
    const cards = [
      c(Rank.Ten), c(Rank.Jack), c(Rank.Queen), c(Rank.King), c(Rank.Ace), c(Rank.Two),
    ];
    expect(identifyCardType(cards)).toBeNull();
  });

  it("含王的顺子无效", () => {
    const cards = [
      c(Rank.Ten), c(Rank.Jack), c(Rank.Queen), c(Rank.King), c(Rank.BlackJoker, null),
    ];
    expect(identifyCardType(cards)).toBeNull();
  });

  // 连对
  it("识别连对（3 对）", () => {
    const cards = [
      c(Rank.Five, Suit.Spade), c(Rank.Five, Suit.Heart),
      c(Rank.Six, Suit.Spade), c(Rank.Six, Suit.Heart),
      c(Rank.Seven, Suit.Spade), c(Rank.Seven, Suit.Heart),
    ];
    const result = identifyCardType(cards);
    expect(result).not.toBeNull();
    expect(result!.type).toBe(CardType.DoubleStraight);
    expect(result!.mainRank).toBe(Rank.Five);
    expect(result!.length).toBe(3);
  });

  it("不连续的对子无效", () => {
    const cards = [
      c(Rank.Five, Suit.Spade), c(Rank.Five, Suit.Heart),
      c(Rank.Six, Suit.Spade), c(Rank.Six, Suit.Heart),
      c(Rank.Eight, Suit.Spade), c(Rank.Eight, Suit.Heart),
    ];
    expect(identifyCardType(cards)).toBeNull();
  });

  // 飞机不带
  it("识别飞机不带（2 组连续三张）", () => {
    const cards = [
      c(Rank.Eight, Suit.Spade), c(Rank.Eight, Suit.Heart), c(Rank.Eight, Suit.Diamond),
      c(Rank.Nine, Suit.Spade), c(Rank.Nine, Suit.Heart), c(Rank.Nine, Suit.Diamond),
    ];
    const result = identifyCardType(cards);
    expect(result).not.toBeNull();
    expect(result!.type).toBe(CardType.TripleStraight);
    expect(result!.mainRank).toBe(Rank.Eight);
    expect(result!.length).toBe(2);
  });

  it("识别 3 组飞机不带", () => {
    const cards = [
      c(Rank.Seven, Suit.Spade), c(Rank.Seven, Suit.Heart), c(Rank.Seven, Suit.Diamond),
      c(Rank.Eight, Suit.Spade), c(Rank.Eight, Suit.Heart), c(Rank.Eight, Suit.Diamond),
      c(Rank.Nine, Suit.Spade), c(Rank.Nine, Suit.Heart), c(Rank.Nine, Suit.Diamond),
    ];
    const result = identifyCardType(cards);
    expect(result).not.toBeNull();
    expect(result!.type).toBe(CardType.TripleStraight);
    expect(result!.mainRank).toBe(Rank.Seven);
    expect(result!.length).toBe(3);
  });

  // 飞机带单
  it("识别飞机带单（2 组三张 + 2 张单）", () => {
    const cards = [
      c(Rank.Jack, Suit.Spade), c(Rank.Jack, Suit.Heart), c(Rank.Jack, Suit.Diamond),
      c(Rank.Queen, Suit.Spade), c(Rank.Queen, Suit.Heart), c(Rank.Queen, Suit.Diamond),
      c(Rank.Three), c(Rank.Five),
    ];
    const result = identifyCardType(cards);
    expect(result).not.toBeNull();
    expect(result!.type).toBe(CardType.TripleStraightWithOnes);
    expect(result!.mainRank).toBe(Rank.Jack);
    expect(result!.length).toBe(2);
  });

  it("飞机带单：翅膀为同 rank 不同花色", () => {
    const cards = [
      c(Rank.Eight, Suit.Spade), c(Rank.Eight, Suit.Heart), c(Rank.Eight, Suit.Diamond),
      c(Rank.Nine, Suit.Spade), c(Rank.Nine, Suit.Heart), c(Rank.Nine, Suit.Diamond),
      c(Rank.Three, Suit.Spade), c(Rank.Three, Suit.Heart),
    ];
    const result = identifyCardType(cards);
    expect(result).not.toBeNull();
    expect(result!.type).toBe(CardType.TripleStraightWithOnes);
    expect(result!.mainRank).toBe(Rank.Eight);
    expect(result!.length).toBe(2);
  });

  // 飞机带对
  it("识别飞机带对（2 组三张 + 2 对）", () => {
    const cards = [
      c(Rank.Ten, Suit.Spade), c(Rank.Ten, Suit.Heart), c(Rank.Ten, Suit.Diamond),
      c(Rank.Jack, Suit.Spade), c(Rank.Jack, Suit.Heart), c(Rank.Jack, Suit.Diamond),
      c(Rank.Three, Suit.Spade), c(Rank.Three, Suit.Heart),
      c(Rank.Five, Suit.Spade), c(Rank.Five, Suit.Heart),
    ];
    const result = identifyCardType(cards);
    expect(result).not.toBeNull();
    expect(result!.type).toBe(CardType.TripleStraightWithPairs);
    expect(result!.mainRank).toBe(Rank.Ten);
    expect(result!.length).toBe(2);
  });

  // 四带二单
  it("识别四带二单", () => {
    const cards = [
      c(Rank.Nine, Suit.Spade), c(Rank.Nine, Suit.Heart),
      c(Rank.Nine, Suit.Diamond), c(Rank.Nine, Suit.Club),
      c(Rank.Three), c(Rank.Five),
    ];
    const result = identifyCardType(cards);
    expect(result).not.toBeNull();
    expect(result!.type).toBe(CardType.QuadWithTwo);
    expect(result!.mainRank).toBe(Rank.Nine);
  });

  it("四带二单：两张附带牌为同 rank 不同花色", () => {
    const cards = [
      c(Rank.Ace, Suit.Spade), c(Rank.Ace, Suit.Heart),
      c(Rank.Ace, Suit.Diamond), c(Rank.Ace, Suit.Club),
      c(Rank.Three, Suit.Spade), c(Rank.Three, Suit.Heart),
    ];
    const result = identifyCardType(cards);
    expect(result).not.toBeNull();
    expect(result!.type).toBe(CardType.QuadWithTwo);
    expect(result!.mainRank).toBe(Rank.Ace);
  });

  // 四带两对
  it("识别四带两对", () => {
    const cards = [
      c(Rank.Ace, Suit.Spade), c(Rank.Ace, Suit.Heart),
      c(Rank.Ace, Suit.Diamond), c(Rank.Ace, Suit.Club),
      c(Rank.Three, Suit.Spade), c(Rank.Three, Suit.Heart),
      c(Rank.Five, Suit.Spade), c(Rank.Five, Suit.Heart),
    ];
    const result = identifyCardType(cards);
    expect(result).not.toBeNull();
    expect(result!.type).toBe(CardType.QuadWithTwoPairs);
    expect(result!.mainRank).toBe(Rank.Ace);
  });

  // 歧义用例：四带两对 vs 飞机带单（8 张牌有 4 张相同时，优先四带两对）
  describe("四带二 vs 飞机歧义", () => {
    it("8 张牌有 4 张相同 → 优先识别为四带两对", () => {
      // 9999 + 88 + TT — 有 4 张 9，应该优先识别为四带两对
      const cards = [
        c(Rank.Nine, Suit.Spade), c(Rank.Nine, Suit.Heart),
        c(Rank.Nine, Suit.Diamond), c(Rank.Nine, Suit.Club),
        c(Rank.Eight, Suit.Spade), c(Rank.Eight, Suit.Heart),
        c(Rank.Ten, Suit.Spade), c(Rank.Ten, Suit.Heart),
      ];
      const result = identifyCardType(cards);
      expect(result).not.toBeNull();
      expect(result!.type).toBe(CardType.QuadWithTwoPairs);
      expect(result!.mainRank).toBe(Rank.Nine);
    });

    it("8 张牌无 4 张相同但有连续三张 → 识别为飞机带单", () => {
      // 888 + 999 + 3 + 5 — 无 4 张相同，有连续三张
      const cards = [
        c(Rank.Eight, Suit.Spade), c(Rank.Eight, Suit.Heart), c(Rank.Eight, Suit.Diamond),
        c(Rank.Nine, Suit.Spade), c(Rank.Nine, Suit.Heart), c(Rank.Nine, Suit.Diamond),
        c(Rank.Three), c(Rank.Five),
      ];
      const result = identifyCardType(cards);
      expect(result).not.toBeNull();
      expect(result!.type).toBe(CardType.TripleStraightWithOnes);
    });
  });

  // 无效牌型
  describe("无效牌型", () => {
    it("2 张不同 rank 非火箭 → null", () => {
      expect(identifyCardType([c(Rank.Three), c(Rank.Five)])).toBeNull();
    });

    it("3 张有 2 种 rank → null", () => {
      const cards = [c(Rank.Three), c(Rank.Three, Suit.Heart), c(Rank.Five)];
      expect(identifyCardType(cards)).toBeNull();
    });

    it("4 张顺子（不足 5 张）→ null", () => {
      const cards = [c(Rank.Three), c(Rank.Four), c(Rank.Five), c(Rank.Six)];
      expect(identifyCardType(cards)).toBeNull();
    });

    it("2 对非连续 → null", () => {
      const cards = [
        c(Rank.Three, Suit.Spade), c(Rank.Three, Suit.Heart),
        c(Rank.Seven, Suit.Spade), c(Rank.Seven, Suit.Heart),
      ];
      expect(identifyCardType(cards)).toBeNull();
    });

    it("三带二但附带的不是对子 → null", () => {
      const cards = [
        c(Rank.Jack, Suit.Spade), c(Rank.Jack, Suit.Heart), c(Rank.Jack, Suit.Diamond),
        c(Rank.Three), c(Rank.Five),
      ];
      // 5 张牌，3 张相同 + 2 张不同单 → 不是三带二（需要一对），也不是三带一（多1张）
      expect(identifyCardType(cards)).toBeNull();
    });

    it("不连续的飞机 → null", () => {
      const cards = [
        c(Rank.Five, Suit.Spade), c(Rank.Five, Suit.Heart), c(Rank.Five, Suit.Diamond),
        c(Rank.Eight, Suit.Spade), c(Rank.Eight, Suit.Heart), c(Rank.Eight, Suit.Diamond),
      ];
      expect(identifyCardType(cards)).toBeNull();
    });
  });
});
