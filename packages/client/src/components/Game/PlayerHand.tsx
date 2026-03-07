import { useGameStore } from "../../store/useGameStore";
import { cardEquals } from "@blitzlord/shared";
import CardComponent from "./CardComponent";

export default function PlayerHand() {
  const myHand = useGameStore((s) => s.myHand);
  const selectedCards = useGameStore((s) => s.selectedCards);
  const toggleCardSelection = useGameStore((s) => s.toggleCardSelection);
  const wildcardRank = useGameStore((s) => s.wildcardRank);

  return (
    <div className="flex justify-center items-end flex-wrap gap-0">
      {myHand.map((card, index) => {
        const isSelected = selectedCards.some((c) => cardEquals(c, card));
        const isWildcard = wildcardRank !== null && card.rank === wildcardRank;
        return (
          <div
            key={`${card.rank}-${card.suit}-${index}`}
            className="-ml-2 first:ml-0 transition-all duration-150"
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
  );
}
