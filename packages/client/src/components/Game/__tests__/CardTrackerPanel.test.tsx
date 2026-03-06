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

  it("renders round separators and dialog semantics", () => {
    const html = renderToStaticMarkup(
      <CardTrackerPanel
        open
        onClose={() => {}}
        remainingByRank={[]}
        history={[
          {
            sequence: 4,
            round: 2,
            playerId: "p1",
            action: "play",
            cards: [],
          },
          {
            sequence: 3,
            round: 1,
            playerId: "p2",
            action: "pass",
            cards: [],
          },
        ]}
        playerNames={{ p1: "Alice", p2: "Bob" }}
      />,
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).not.toContain('aria-hidden="true"');
    expect(html).toContain("新一轮");
    expect(html).toContain("Round 2");
  });
});
