import type { CSSProperties } from "react";
import type { Card, Rank } from "@blitzlord/shared";
import { cardEquals } from "@blitzlord/shared";
import { useDoudizhuGameStore } from "../../games/doudizhu/store/useDoudizhuGameStore";
import CardComponent from "./CardComponent";

interface PlayerHandLayoutProps {
  myHand: Card[];
  selectedCards: Card[];
  toggleCardSelection: (card: Card) => void;
  wildcardRank: Rank | null;
}

export function PlayerHandLayout({
  myHand,
  selectedCards,
  toggleCardSelection,
  wildcardRank,
}: PlayerHandLayoutProps) {
  const midpoint = (myHand.length - 1) / 2;

  return (
    <div className="player-hand-shell">
      <div className="player-hand-scroll">
        <div
          className="player-hand-row"
          aria-label={"\u6211\u7684\u624b\u724c"}
          role="list"
        >
          {myHand.map((card, index) => {
            const isSelected = selectedCards.some((c) => cardEquals(c, card));
            const isWildcard = wildcardRank !== null && card.rank === wildcardRank;
            const offset = index - midpoint;
            const tilt = Math.max(-9, Math.min(9, offset * 1.45));
            const depth = Math.min(10, Math.abs(offset) * 0.55);

            return (
              <div
                key={`${card.rank}-${card.suit}-${index}`}
                className="player-hand-card"
                role="listitem"
                style={
                  {
                    "--hand-tilt": `${tilt}deg`,
                    "--hand-depth": `${depth}px`,
                    zIndex: index + 1,
                  } as CSSProperties
                }
              >
                <CardComponent
                  card={card}
                  selected={isSelected}
                  isWildcard={isWildcard}
                  onClick={() => toggleCardSelection(card)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function PlayerHand() {
  const myHand = useDoudizhuGameStore((s) => s.myHand);
  const selectedCards = useDoudizhuGameStore((s) => s.selectedCards);
  const toggleCardSelection = useDoudizhuGameStore((s) => s.toggleCardSelection);
  const wildcardRank = useDoudizhuGameStore((s) => s.wildcardRank);

  return (
    <PlayerHandLayout
      myHand={myHand}
      selectedCards={selectedCards}
      toggleCardSelection={toggleCardSelection}
      wildcardRank={wildcardRank}
    />
  );
}
