import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CardType, Rank, Suit, type CardPlay } from "@blitzlord/shared";
import PlayedCards from "../PlayedCards";

function pairWithWildcard(): CardPlay {
  return {
    type: CardType.Pair,
    mainRank: Rank.Ace,
    cards: [
      { rank: Rank.Ace, suit: Suit.Spade },
      { rank: Rank.Seven, suit: Suit.Heart },
    ],
  };
}

function straightWithWildcards(): CardPlay {
  return {
    type: CardType.Straight,
    mainRank: Rank.Three,
    length: 5,
    cards: [
      { rank: Rank.Three, suit: Suit.Spade },
      { rank: Rank.Seven, suit: Suit.Heart },
      { rank: Rank.Five, suit: Suit.Club },
      { rank: Rank.Six, suit: Suit.Diamond },
      { rank: Rank.Seven, suit: Suit.Spade },
    ],
  };
}

function countOccurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

describe("PlayedCards", () => {
  it("renders transformed wildcard cards for the last play", () => {
    const html = renderToStaticMarkup(
      createElement(PlayedCards as any, {
        lastPlay: {
          playerId: "p2",
          play: pairWithWildcard(),
        },
        lastPassPlayerId: null,
        playerNames: { p2: "Bob" },
        wildcardRank: Rank.Seven,
      }),
    );

    expect(html).toContain("Bob");
    expect(html).toContain(">A<");
    expect(html).not.toContain(">7<");
  });

  it("renders transformed wildcard cards for straights", () => {
    const html = renderToStaticMarkup(
      createElement(PlayedCards as any, {
        lastPlay: {
          playerId: "p2",
          play: straightWithWildcards(),
        },
        lastPassPlayerId: null,
        playerNames: { p2: "Bob" },
        wildcardRank: Rank.Seven,
      }),
    );

    expect(html).toContain("Bob");
    expect(countOccurrences(html, ">4<")).toBe(2);
    expect(countOccurrences(html, ">7<")).toBe(2);
  });
});
