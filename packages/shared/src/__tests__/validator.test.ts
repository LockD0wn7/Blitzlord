import { describe, expect, it } from "vitest";
import { validatePlay } from "../games/doudizhu/index.js";
import { CardType, Rank, Suit } from "../types/card.js";
import type { Card, CardPlay } from "../types/card.js";

function c(rank: Rank, suit: Suit | null = Suit.Spade): Card {
  return { rank, suit };
}

const sampleHand: Card[] = [
  c(Rank.Three, Suit.Spade),
  c(Rank.Four, Suit.Spade),
  c(Rank.Five, Suit.Spade),
  c(Rank.Six, Suit.Spade),
  c(Rank.Seven, Suit.Spade),
  c(Rank.Seven, Suit.Heart),
  c(Rank.Eight, Suit.Spade),
  c(Rank.Nine, Suit.Spade),
  c(Rank.Nine, Suit.Heart),
  c(Rank.Nine, Suit.Diamond),
  c(Rank.Ten, Suit.Spade),
  c(Rank.Jack, Suit.Spade),
  c(Rank.Queen, Suit.Spade),
  c(Rank.King, Suit.Spade),
  c(Rank.Ace, Suit.Spade),
  c(Rank.Two, Suit.Spade),
  c(Rank.BlackJoker, null),
];

describe("validatePlay", () => {
  // 基本验证
  it("空牌无效", () => {
    const result = validatePlay([], sampleHand, null);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("没有选择任何牌");
  });

  it("选的牌不在手牌中 → 无效", () => {
    const result = validatePlay([c(Rank.RedJoker, null)], sampleHand, null);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("选择的牌不在手牌中");
  });

  it("无效牌型 → 无效", () => {
    const result = validatePlay(
      [c(Rank.Three, Suit.Spade), c(Rank.Five, Suit.Spade)],
      sampleHand,
      null,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe("无效的牌型");
  });

  // 自由出牌
  it("自由出牌：任何有效牌型都可以", () => {
    const result = validatePlay([c(Rank.Three, Suit.Spade)], sampleHand, null);
    expect(result.valid).toBe(true);
    expect(result.play).not.toBeUndefined();
    expect(result.play!.type).toBe(CardType.Single);
  });

  it("自由出牌：对子", () => {
    const result = validatePlay(
      [c(Rank.Seven, Suit.Spade), c(Rank.Seven, Suit.Heart)],
      sampleHand,
      null,
    );
    expect(result.valid).toBe(true);
    expect(result.play!.type).toBe(CardType.Pair);
  });

  it("自由出牌：顺子", () => {
    const result = validatePlay(
      [
        c(Rank.Three, Suit.Spade), c(Rank.Four, Suit.Spade),
        c(Rank.Five, Suit.Spade), c(Rank.Six, Suit.Spade),
        c(Rank.Seven, Suit.Spade),
      ],
      sampleHand,
      null,
    );
    expect(result.valid).toBe(true);
    expect(result.play!.type).toBe(CardType.Straight);
  });

  // 跟牌
  it("跟牌：大单张能打小单张", () => {
    const previous: CardPlay = {
      type: CardType.Single,
      cards: [c(Rank.King)],
      mainRank: Rank.King,
    };
    const result = validatePlay([c(Rank.Two, Suit.Spade)], sampleHand, previous);
    expect(result.valid).toBe(true);
    expect(result.play!.type).toBe(CardType.Single);
  });

  it("跟牌：小单张打不过大单张", () => {
    const previous: CardPlay = {
      type: CardType.Single,
      cards: [c(Rank.Ace)],
      mainRank: Rank.Ace,
    };
    const result = validatePlay([c(Rank.King, Suit.Spade)], sampleHand, previous);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("打不过上家的牌");
  });

  it("跟牌：对子只能用更大的对子打", () => {
    const previous: CardPlay = {
      type: CardType.Pair,
      cards: [c(Rank.Eight, Suit.Spade), c(Rank.Eight, Suit.Heart)],
      mainRank: Rank.Eight,
    };
    const result = validatePlay(
      [c(Rank.Nine, Suit.Spade), c(Rank.Nine, Suit.Heart)],
      sampleHand,
      previous,
    );
    expect(result.valid).toBe(true);
  });

  it("跟牌：类型不同打不过（单张打不过对子）", () => {
    const previous: CardPlay = {
      type: CardType.Pair,
      cards: [c(Rank.Three, Suit.Spade), c(Rank.Three, Suit.Heart)],
      mainRank: Rank.Three,
    };
    const result = validatePlay([c(Rank.Two, Suit.Spade)], sampleHand, previous);
    expect(result.valid).toBe(false);
  });

  // 重复牌检测
  it("同一张牌不能出两次", () => {
    const result = validatePlay(
      [c(Rank.Three, Suit.Spade), c(Rank.Three, Suit.Spade)],
      sampleHand,
      null,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe("选择的牌不在手牌中");
  });
});
