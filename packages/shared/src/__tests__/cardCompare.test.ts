import { describe, expect, it } from "vitest";
import { canBeat } from "../rules/cardCompare.js";
import { CardType, Rank } from "../types/card.js";
import type { Card, CardPlay } from "../types/card.js";
import { Suit } from "../types/card.js";

/** 快速构造 CardPlay */
function play(type: CardType, mainRank: Rank, length?: number): CardPlay {
  return { type, cards: [], mainRank, length };
}

describe("canBeat", () => {
  // 火箭
  it("火箭打一切", () => {
    const rocket = play(CardType.Rocket, Rank.RedJoker);
    expect(canBeat(rocket, play(CardType.Bomb, Rank.Two))).toBe(true);
    expect(canBeat(rocket, play(CardType.Single, Rank.Ace))).toBe(true);
    expect(canBeat(rocket, play(CardType.Straight, Rank.Three, 5))).toBe(true);
  });


  // 炸弹
  it("炸弹打非炸弹", () => {
    const bomb = play(CardType.Bomb, Rank.Three);
    expect(canBeat(bomb, play(CardType.Single, Rank.Two))).toBe(true);
    expect(canBeat(bomb, play(CardType.Pair, Rank.Ace))).toBe(true);
    expect(canBeat(bomb, play(CardType.Straight, Rank.Three, 5))).toBe(true);
  });

  it("大炸弹打小炸弹", () => {
    expect(canBeat(play(CardType.Bomb, Rank.Ace), play(CardType.Bomb, Rank.King))).toBe(true);
  });

  it("小炸弹打不过大炸弹", () => {
    expect(canBeat(play(CardType.Bomb, Rank.King), play(CardType.Bomb, Rank.Ace))).toBe(false);
  });

  it("相同 rank 炸弹不能互打", () => {
    expect(canBeat(play(CardType.Bomb, Rank.Seven), play(CardType.Bomb, Rank.Seven))).toBe(false);
  });

  it("炸弹打不过火箭", () => {
    expect(canBeat(play(CardType.Bomb, Rank.Two), play(CardType.Rocket, Rank.RedJoker))).toBe(false);
  });

  it("非炸弹打不过炸弹", () => {
    expect(canBeat(play(CardType.Single, Rank.Two), play(CardType.Bomb, Rank.Three))).toBe(false);
  });

  // 同类型比较
  it("大单张打小单张", () => {
    expect(canBeat(play(CardType.Single, Rank.Ace), play(CardType.Single, Rank.King))).toBe(true);
  });

  it("小单张打不过大单张", () => {
    expect(canBeat(play(CardType.Single, Rank.King), play(CardType.Single, Rank.Ace))).toBe(false);
  });

  it("相同大小不能打", () => {
    expect(canBeat(play(CardType.Single, Rank.Ace), play(CardType.Single, Rank.Ace))).toBe(false);
  });

  it("大对子打小对子", () => {
    expect(canBeat(play(CardType.Pair, Rank.Two), play(CardType.Pair, Rank.Ace))).toBe(true);
  });

  it("三带一比 mainRank", () => {
    expect(canBeat(
      play(CardType.TripleWithOne, Rank.King),
      play(CardType.TripleWithOne, Rank.Jack),
    )).toBe(true);
  });

  // 顺子：需同长度
  it("同长度大顺子打小顺子", () => {
    expect(canBeat(
      play(CardType.Straight, Rank.Four, 5),
      play(CardType.Straight, Rank.Three, 5),
    )).toBe(true);
  });

  it("不同长度顺子不能比", () => {
    expect(canBeat(
      play(CardType.Straight, Rank.Three, 6),
      play(CardType.Straight, Rank.Three, 5),
    )).toBe(false);
  });

  it("顺子缺失 length 时不能比较成功", () => {
    const current = {
      type: CardType.Straight,
      cards: [],
      mainRank: Rank.Four,
    } as CardPlay;
    const previous = play(CardType.Straight, Rank.Three, 5);
    expect(canBeat(current, previous)).toBe(false);
  });

  // 连对：需同长度
  it("同长度大连对打小连对", () => {
    expect(canBeat(
      play(CardType.DoubleStraight, Rank.Six, 3),
      play(CardType.DoubleStraight, Rank.Five, 3),
    )).toBe(true);
  });

  // 飞机：需同长度
  it("同长度大飞机打小飞机", () => {
    expect(canBeat(
      play(CardType.TripleStraightWithOnes, Rank.Nine, 2),
      play(CardType.TripleStraightWithOnes, Rank.Eight, 2),
    )).toBe(true);
  });

  // 不同类型不能比（除炸弹/火箭外）
  it("不同类型不能比较", () => {
    expect(canBeat(play(CardType.Single, Rank.Two), play(CardType.Pair, Rank.Three))).toBe(false);
    expect(canBeat(play(CardType.Pair, Rank.Two), play(CardType.Triple, Rank.Three))).toBe(false);
    expect(canBeat(
      play(CardType.TripleWithOne, Rank.Ace),
      play(CardType.TripleWithPair, Rank.Three),
    )).toBe(false);
  });

  // 四带二
  it("大四带二单打小四带二单", () => {
    expect(canBeat(
      play(CardType.QuadWithTwo, Rank.Ace),
      play(CardType.QuadWithTwo, Rank.King),
    )).toBe(true);
  });

  it("四带两对之间比较", () => {
    expect(canBeat(
      play(CardType.QuadWithTwoPairs, Rank.Ten),
      play(CardType.QuadWithTwoPairs, Rank.Nine),
    )).toBe(true);
  });
});
