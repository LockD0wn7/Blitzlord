import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Rank, Suit } from "@blitzlord/shared";
import CardComponent from "../CardComponent";

describe("CardComponent", () => {
  it("renders hand cards with the large size modifier", () => {
    const html = renderToStaticMarkup(
      <CardComponent card={{ rank: Rank.Ace, suit: Suit.Spade }} />,
    );

    expect(html).toContain("card-shell");
    expect(html).toContain("card-shell--hand");
  });

  it("renders compact cards with the small size modifier", () => {
    const html = renderToStaticMarkup(
      <CardComponent card={{ rank: Rank.King, suit: Suit.Heart }} small />,
    );

    expect(html).toContain("card-shell");
    expect(html).toContain("card-shell--small");
  });
});
