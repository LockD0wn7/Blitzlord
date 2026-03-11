import { describe, expect, it } from "vitest";
import { validatePlay } from "../games/doudizhu/index.js";
import { CardType, Rank, Suit } from "../types/card.js";
import type { Card, CardPlay } from "../types/card.js";

function c(rank: Rank, suit: Suit | null = Suit.Spade): Card {
  return { rank, suit };
}

describe("validatePlay with wildcardRank", () => {
  // 手牌包含赖子(7)和普通牌
  const hand: Card[] = [
    c(Rank.Seven, Suit.Spade),
    c(Rank.Seven, Suit.Heart),
    c(Rank.Eight, Suit.Spade),
    c(Rank.Eight, Suit.Heart),
    c(Rank.Nine, Suit.Spade),
    c(Rank.Ten, Suit.Spade),
    c(Rank.Jack, Suit.Spade),
    c(Rank.Queen, Suit.Spade),
  ];

  it("赖子+8 从手牌中出一对8 (valid)", () => {
    const cards = [c(Rank.Seven, Suit.Spade), c(Rank.Eight, Suit.Spade)];
    const result = validatePlay(cards, hand, null, Rank.Seven);
    expect(result.valid).toBe(true);
    expect(result.play!.type).toBe(CardType.Pair);
    expect(result.play!.mainRank).toBe(Rank.Eight);
  });

  it("非赖子模式下 7+8 不是合法牌型 (invalid)", () => {
    const cards = [c(Rank.Seven, Suit.Spade), c(Rank.Eight, Suit.Spade)];
    const result = validatePlay(cards, hand, null);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("无效的牌型");
  });

  it("赖子模式下软炸可以压非炸牌型 (valid)", () => {
    // 上家出单牌 Ace
    const previousPlay: CardPlay = {
      type: CardType.Single,
      cards: [c(Rank.Ace)],
      mainRank: Rank.Ace,
    };
    // 用 3 张 8 + 1 张赖子7 组成软炸
    const bombHand: Card[] = [
      c(Rank.Seven, Suit.Spade),
      c(Rank.Eight, Suit.Spade),
      c(Rank.Eight, Suit.Heart),
      c(Rank.Eight, Suit.Diamond),
    ];
    const cards = [...bombHand];
    const result = validatePlay(cards, bombHand, previousPlay, Rank.Seven);
    expect(result.valid).toBe(true);
    expect(result.play!.type).toBe(CardType.Bomb);
    expect(result.play!.softBomb).toBe(true);
  });

  it("赖子模式下硬炸可以压软炸 (valid)", () => {
    // 上家出软炸（3张9 + 赖子）
    const previousPlay: CardPlay = {
      type: CardType.Bomb,
      cards: [
        c(Rank.Nine, Suit.Spade),
        c(Rank.Nine, Suit.Heart),
        c(Rank.Nine, Suit.Diamond),
        c(Rank.Seven, Suit.Club),
      ],
      mainRank: Rank.Nine,
      softBomb: true,
    };
    // 出硬炸 4张8
    const hardBombHand: Card[] = [
      c(Rank.Eight, Suit.Spade),
      c(Rank.Eight, Suit.Heart),
      c(Rank.Eight, Suit.Diamond),
      c(Rank.Eight, Suit.Club),
    ];
    const cards = [...hardBombHand];
    const result = validatePlay(cards, hardBombHand, previousPlay, Rank.Seven);
    expect(result.valid).toBe(true);
    expect(result.play!.type).toBe(CardType.Bomb);
    expect(result.play!.softBomb).toBeUndefined();
  });

  it("不传 wildcardRank 行为不变 (backward compatibility)", () => {
    // 出一对8
    const cards = [c(Rank.Eight, Suit.Spade), c(Rank.Eight, Suit.Heart)];
    const result = validatePlay(cards, hand, null);
    expect(result.valid).toBe(true);
    expect(result.play!.type).toBe(CardType.Pair);
    expect(result.play!.mainRank).toBe(Rank.Eight);
  });
});
