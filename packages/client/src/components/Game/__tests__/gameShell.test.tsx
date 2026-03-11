import { beforeAll, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ClientGameRegistryLike } from "../../../platform/gameRegistry";

let GameShellView: (props: {
  roomId: string;
  gameId: string;
  registry?: ClientGameRegistryLike;
}) => React.ReactElement;

function createRegistry(): ClientGameRegistryLike {
  return {
    getGame(gameId) {
      if (gameId !== "doudizhu") {
        return null;
      }

      return {
        gameId: "doudizhu",
        gameName: "Doudizhu",
        MatchView: ({ roomId }: { roomId: string }) => (
          <section data-game="doudizhu">match:{roomId}</section>
        ),
      };
    },
  };
}

describe("GameShell", () => {
  beforeAll(async () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
        clear: () => {},
      },
    });

    ({ GameShellView } = await import("../../../platform/GameShell"));
  });

  it("renders the registered doudizhu match view", () => {
    const html = renderToStaticMarkup(
      <GameShellView
        roomId="room-1"
        gameId="doudizhu"
        registry={createRegistry()}
      />,
    );

    expect(html).toContain('data-game="doudizhu"');
    expect(html).toContain("match:room-1");
  });

  it("renders a fallback for unsupported games", () => {
    const html = renderToStaticMarkup(
      <GameShellView
        roomId="room-2"
        gameId="mahjong"
        registry={createRegistry()}
      />,
    );

    expect(html).toContain("Unsupported game");
    expect(html).toContain("mahjong");
  });
});
