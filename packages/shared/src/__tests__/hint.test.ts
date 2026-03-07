import { describe, expect, it } from "vitest";
import { getPlayableHints } from "../rules/hint.js";
import { CardType, Rank, Suit } from "../types/card.js";
import type { Card, CardPlay } from "../types/card.js";

function c(rank: Rank, suit: Suit | null = Suit.Spade): Card {
  return { rank, suit };
}

function play(type: CardType, mainRank: Rank, cards: Card[], length?: number): CardPlay {
  return { type, mainRank, cards, length };
}

describe("getPlayableHints", () => {
  it("自由出牌时按稳定顺序返回可出方案", () => {
    const result = getPlayableHints(
      [
        c(Rank.Three, Suit.Spade),
        c(Rank.Three, Suit.Heart),
        c(Rank.Four, Suit.Spade),
        c(Rank.BlackJoker, null),
        c(Rank.RedJoker, null),
      ],
      null,
    );

    expect(
      result.map((entry) => ({
        type: entry.type,
        mainRank: entry.mainRank,
        length: entry.length,
      })),
    ).toEqual([
      { type: CardType.Single, mainRank: Rank.Three, length: undefined },
      { type: CardType.Single, mainRank: Rank.Four, length: undefined },
      { type: CardType.Single, mainRank: Rank.BlackJoker, length: undefined },
      { type: CardType.Single, mainRank: Rank.RedJoker, length: undefined },
      { type: CardType.Pair, mainRank: Rank.Three, length: undefined },
      { type: CardType.Rocket, mainRank: Rank.RedJoker, length: undefined },
    ]);
  });

  it("跟牌时先返回普通解法，再返回炸弹和王炸", () => {
    const result = getPlayableHints(
      [
        c(Rank.Jack, Suit.Spade),
        c(Rank.King, Suit.Spade),
        c(Rank.Four, Suit.Spade),
        c(Rank.Four, Suit.Heart),
        c(Rank.Four, Suit.Diamond),
        c(Rank.Four, Suit.Club),
        c(Rank.BlackJoker, null),
        c(Rank.RedJoker, null),
      ],
      play(CardType.Single, Rank.Ten, [c(Rank.Ten, Suit.Spade)]),
    );

    expect(
      result.map((entry) => ({
        type: entry.type,
        mainRank: entry.mainRank,
      })),
    ).toEqual([
      { type: CardType.Single, mainRank: Rank.Jack },
      { type: CardType.Single, mainRank: Rank.King },
      { type: CardType.Single, mainRank: Rank.BlackJoker },
      { type: CardType.Single, mainRank: Rank.RedJoker },
      { type: CardType.Bomb, mainRank: Rank.Four },
      { type: CardType.Rocket, mainRank: Rank.RedJoker },
    ]);
  });

  it("四张牌生成三张提示时会去重", () => {
    const result = getPlayableHints(
      [
        c(Rank.Five, Suit.Spade),
        c(Rank.Five, Suit.Heart),
        c(Rank.Five, Suit.Diamond),
        c(Rank.Five, Suit.Club),
      ],
      play(CardType.Triple, Rank.Four, [
        c(Rank.Four),
        c(Rank.Four, Suit.Heart),
        c(Rank.Four, Suit.Diamond),
      ]),
    );

    expect(
      result.map((entry) => ({
        type: entry.type,
        mainRank: entry.mainRank,
      })),
    ).toEqual([
      { type: CardType.Triple, mainRank: Rank.Five },
      { type: CardType.Bomb, mainRank: Rank.Five },
    ]);
  });

  it("顺子按长度再按主牌点数排序", () => {
    const result = getPlayableHints(
      [
        c(Rank.Three),
        c(Rank.Four),
        c(Rank.Five),
        c(Rank.Six),
        c(Rank.Seven),
        c(Rank.Eight),
      ],
      null,
    ).filter((entry) => entry.type === CardType.Straight);

    expect(
      result.map((entry) => ({
        mainRank: entry.mainRank,
        length: entry.length,
      })),
    ).toEqual([
      { mainRank: Rank.Three, length: 5 },
      { mainRank: Rank.Four, length: 5 },
      { mainRank: Rank.Three, length: 6 },
    ]);
  });

  it("可以枚举三带二", () => {
    const result = getPlayableHints(
      [
        c(Rank.Three, Suit.Spade),
        c(Rank.Three, Suit.Heart),
        c(Rank.Three, Suit.Diamond),
        c(Rank.Five, Suit.Spade),
        c(Rank.Five, Suit.Heart),
      ],
      null,
    ).filter((entry) => entry.type === CardType.TripleWithPair);

    expect(
      result.map((entry) => ({
        type: entry.type,
        mainRank: entry.mainRank,
      })),
    ).toEqual([{ type: CardType.TripleWithPair, mainRank: Rank.Three }]);
  });

  it("可以枚举飞机带单", () => {
    const result = getPlayableHints(
      [
        c(Rank.Three, Suit.Spade),
        c(Rank.Three, Suit.Heart),
        c(Rank.Three, Suit.Diamond),
        c(Rank.Four, Suit.Spade),
        c(Rank.Four, Suit.Heart),
        c(Rank.Four, Suit.Diamond),
        c(Rank.Seven, Suit.Spade),
        c(Rank.Eight, Suit.Spade),
      ],
      null,
    ).filter((entry) => entry.type === CardType.TripleStraightWithOnes);

    expect(
      result.map((entry) => ({
        type: entry.type,
        mainRank: entry.mainRank,
        length: entry.length,
      })),
    ).toEqual([
      {
        type: CardType.TripleStraightWithOnes,
        mainRank: Rank.Three,
        length: 2,
      },
    ]);
  });

  it("可以枚举飞机带对", () => {
    const result = getPlayableHints(
      [
        c(Rank.Three, Suit.Spade),
        c(Rank.Three, Suit.Heart),
        c(Rank.Three, Suit.Diamond),
        c(Rank.Four, Suit.Spade),
        c(Rank.Four, Suit.Heart),
        c(Rank.Four, Suit.Diamond),
        c(Rank.Seven, Suit.Spade),
        c(Rank.Seven, Suit.Heart),
        c(Rank.Eight, Suit.Spade),
        c(Rank.Eight, Suit.Heart),
      ],
      null,
    ).filter((entry) => entry.type === CardType.TripleStraightWithPairs);

    expect(
      result.map((entry) => ({
        type: entry.type,
        mainRank: entry.mainRank,
        length: entry.length,
      })),
    ).toEqual([
      {
        type: CardType.TripleStraightWithPairs,
        mainRank: Rank.Three,
        length: 2,
      },
    ]);
  });

  it("可以枚举四带两对", () => {
    const result = getPlayableHints(
      [
        c(Rank.Five, Suit.Spade),
        c(Rank.Five, Suit.Heart),
        c(Rank.Five, Suit.Diamond),
        c(Rank.Five, Suit.Club),
        c(Rank.Seven, Suit.Spade),
        c(Rank.Seven, Suit.Heart),
        c(Rank.Eight, Suit.Spade),
        c(Rank.Eight, Suit.Heart),
      ],
      null,
    ).filter((entry) => entry.type === CardType.QuadWithTwoPairs);

    expect(
      result.map((entry) => ({
        type: entry.type,
        mainRank: entry.mainRank,
      })),
    ).toEqual([{ type: CardType.QuadWithTwoPairs, mainRank: Rank.Five }]);
  });
});
