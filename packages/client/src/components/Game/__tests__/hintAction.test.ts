import { describe, expect, it } from "vitest";
import { CardType, Rank, Suit, type Card, type CardPlay } from "@blitzlord/shared";
import { resolveHintAction } from "../hintAction";

function card(rank: Rank, suit: Suit | null = Suit.Spade): Card {
  return { rank, suit };
}

function single(rank: Rank): CardPlay {
  return {
    type: CardType.Single,
    mainRank: rank,
    cards: [card(rank)],
  };
}

describe("resolveHintAction", () => {
  it("不是自己回合时不返回提示选择", () => {
    expect(
      resolveHintAction({
        isMyTurn: false,
        token: "me",
        myHand: [card(Rank.Three)],
        currentTurn: "p2",
        lastPlay: null,
        hintContextKey: null,
        hintCursor: 0,
      }),
    ).toEqual({ type: "noop" });
  });

  it("跟牌时使用对手上一手牌，并在同一局面下轮换", () => {
    const first = resolveHintAction({
      isMyTurn: true,
      token: "me",
      myHand: [
        card(Rank.Jack),
        card(Rank.King),
        card(Rank.Four, Suit.Spade),
        card(Rank.Four, Suit.Heart),
        card(Rank.Four, Suit.Diamond),
        card(Rank.Four, Suit.Club),
      ],
      currentTurn: "me",
      lastPlay: { playerId: "p2", play: single(Rank.Ten) },
      hintContextKey: null,
      hintCursor: 0,
    });

    expect(first).toMatchObject({
      type: "selection",
      cards: [card(Rank.Jack)],
      nextCursor: 1,
    });

    const second = resolveHintAction({
      isMyTurn: true,
      token: "me",
      myHand: [
        card(Rank.Jack),
        card(Rank.King),
        card(Rank.Four, Suit.Spade),
        card(Rank.Four, Suit.Heart),
        card(Rank.Four, Suit.Diamond),
        card(Rank.Four, Suit.Club),
      ],
      currentTurn: "me",
      lastPlay: { playerId: "p2", play: single(Rank.Ten) },
      hintContextKey:
        first.type === "selection" ? first.contextKey : null,
      hintCursor: first.type === "selection" ? first.nextCursor : 0,
    });

    expect(second).toMatchObject({
      type: "selection",
      cards: [card(Rank.King)],
    });
  });

  it("自己掌牌时按自由出牌处理，而不是跟自己的上一手牌", () => {
    const result = resolveHintAction({
      isMyTurn: true,
      token: "me",
      myHand: [card(Rank.Three), card(Rank.Three, Suit.Heart), card(Rank.Four)],
      currentTurn: "me",
      lastPlay: { playerId: "me", play: single(Rank.Two) },
      hintContextKey: null,
      hintCursor: 0,
    });

    expect(result).toMatchObject({
      type: "selection",
      cards: [{ rank: Rank.Three }],
    });
  });

  it("无解时返回错误信息", () => {
    expect(
      resolveHintAction({
        isMyTurn: true,
        token: "me",
        myHand: [card(Rank.Three)],
        currentTurn: "me",
        lastPlay: { playerId: "p2", play: single(Rank.Four) },
        hintContextKey: null,
        hintCursor: 0,
      }),
    ).toEqual({
      type: "error",
      message: "没有可出的牌，请选择不出",
    });
  });
});
