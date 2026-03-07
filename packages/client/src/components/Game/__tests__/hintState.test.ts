import { describe, expect, it } from "vitest";
import { CardType, Rank, Suit, type Card, type CardPlay } from "@blitzlord/shared";
import { buildHintContextKey, getNextHintSelection } from "../hintState";

function card(rank: Rank, suit: Suit | null = Suit.Spade): Card {
  return { rank, suit };
}

function play(rank: Rank): CardPlay {
  return {
    type: CardType.Single,
    mainRank: rank,
    cards: [card(rank)],
  };
}

describe("hintState helpers", () => {
  it("在新局面下返回第一组提示并推进游标", () => {
    const contextKey = buildHintContextKey({
      myHand: [card(Rank.Four), card(Rank.Three)],
      previousPlay: null,
      currentTurn: "me",
    });

    const result = getNextHintSelection({
      hints: [play(Rank.Three), play(Rank.Four)],
      contextKey,
      hintContextKey: null,
      hintCursor: 0,
    });

    expect(result).toEqual({
      cards: [card(Rank.Three)],
      contextKey,
      nextCursor: 1,
    });
  });

  it("在同一局面下连续点击时轮换，在局面变化后重置", () => {
    const hints = [play(Rank.Three), play(Rank.Four)];
    const firstContext = buildHintContextKey({
      myHand: [card(Rank.Four), card(Rank.Three)],
      previousPlay: null,
      currentTurn: "me",
    });

    const secondSelection = getNextHintSelection({
      hints,
      contextKey: firstContext,
      hintContextKey: firstContext,
      hintCursor: 1,
    });

    expect(secondSelection).toEqual({
      cards: [card(Rank.Four)],
      contextKey: firstContext,
      nextCursor: 0,
    });

    const changedContext = buildHintContextKey({
      myHand: [card(Rank.Five), card(Rank.Three)],
      previousPlay: null,
      currentTurn: "me",
    });

    const resetSelection = getNextHintSelection({
      hints,
      contextKey: changedContext,
      hintContextKey: firstContext,
      hintCursor: 1,
    });

    expect(resetSelection).toEqual({
      cards: [card(Rank.Three)],
      contextKey: changedContext,
      nextCursor: 1,
    });
  });

  it("没有提示方案时返回 null", () => {
    const contextKey = buildHintContextKey({
      myHand: [card(Rank.Three)],
      previousPlay: null,
      currentTurn: "me",
    });

    expect(
      getNextHintSelection({
        hints: [],
        contextKey,
        hintContextKey: null,
        hintCursor: 0,
      }),
    ).toBeNull();
  });
});
