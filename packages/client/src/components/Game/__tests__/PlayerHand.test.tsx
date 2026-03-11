import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Rank, Suit } from "@blitzlord/shared";
import { PlayerHandLayout } from "../PlayerHand";

describe("PlayerHand", () => {
  it("renders cards inside a scrollable hand rail", () => {
    const html = renderToStaticMarkup(
      <PlayerHandLayout
        myHand={[
          { rank: Rank.Three, suit: Suit.Spade },
          { rank: Rank.Four, suit: Suit.Heart },
          { rank: Rank.Five, suit: Suit.Club },
        ]}
        selectedCards={[]}
        toggleCardSelection={() => {}}
        wildcardRank={null}
      />,
    );

    expect(html).toContain("player-hand-shell");
    expect(html).toContain("player-hand-scroll");
    expect(html).toContain("player-hand-row");
    expect(html).toContain("player-hand-card");
  });
});
