import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Rank } from "@blitzlord/shared";
import CardTrackerPanel from "../CardTrackerPanel";

describe("CardTrackerPanel", () => {
  it("renders tracker stats and history entries", () => {
    const html = renderToStaticMarkup(
      <CardTrackerPanel
        open
        onClose={() => {}}
        remainingByRank={[
          {
            rank: Rank.Ace,
            totalCopies: 4,
            playedCopies: 1,
            myCopies: 1,
            remainingOpponentCopies: 2,
          },
        ]}
        history={[
          {
            sequence: 3,
            round: 2,
            playerId: "p2",
            action: "play",
            cards: [],
          },
        ]}
        playerNames={{ p2: "Bob" }}
      />,
    );

    expect(html).toContain("记牌器");
    expect(html).toContain("A");
    expect(html).toContain("Bob");
    expect(html).toContain("出牌");
  });
});
