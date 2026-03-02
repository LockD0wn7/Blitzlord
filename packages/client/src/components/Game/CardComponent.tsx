import type { Card } from "@blitzlord/shared";
import { Suit, Rank, RANK_NAMES, SUIT_SYMBOLS } from "@blitzlord/shared";

interface CardComponentProps {
  card: Card;
  selected?: boolean;
  onClick?: () => void;
  small?: boolean;
}

function getSuitColor(suit: Suit | null, rank: Rank): string {
  if (rank === Rank.RedJoker) return "text-red-600";
  if (rank === Rank.BlackJoker) return "text-gray-800";
  if (suit === Suit.Heart || suit === Suit.Diamond) return "text-red-600";
  return "text-gray-800";
}

export default function CardComponent({
  card,
  selected = false,
  onClick,
  small = false,
}: CardComponentProps) {
  const isJoker = card.rank === Rank.BlackJoker || card.rank === Rank.RedJoker;
  const color = getSuitColor(card.suit, card.rank);
  const rankName = RANK_NAMES[card.rank];
  const suitSymbol = card.suit ? SUIT_SYMBOLS[card.suit] : "";

  return (
    <div
      onClick={onClick}
      className={`
        relative inline-flex flex-col items-center justify-start
        bg-white rounded-lg shadow-md border border-gray-200
        select-none transition-transform duration-100
        ${small ? "w-10 h-14 text-xs" : "w-14 h-20 text-sm"}
        ${selected ? "-translate-y-3" : ""}
        ${onClick ? "cursor-pointer hover:shadow-lg hover:-translate-y-1" : ""}
        ${selected && onClick ? "ring-2 ring-yellow-400 -translate-y-3" : ""}
      `}
    >
      {isJoker ? (
        <div
          className={`flex flex-col items-center justify-center h-full ${color} font-bold`}
        >
          <span className={small ? "text-xs" : "text-sm"}>{rankName}</span>
        </div>
      ) : (
        <>
          <div
            className={`self-start ${color} font-bold ${
              small ? "ml-0.5 mt-0.5" : "ml-1 mt-1"
            }`}
          >
            <div className={small ? "text-xs leading-tight" : "text-sm leading-tight"}>
              {rankName}
            </div>
            <div className={small ? "text-xs leading-tight" : "text-sm leading-tight"}>
              {suitSymbol}
            </div>
          </div>
          <div
            className={`absolute bottom-0 right-0 ${color} font-bold rotate-180 ${
              small ? "mr-0.5 mb-0.5" : "mr-1 mb-1"
            }`}
          >
            <div className={small ? "text-xs leading-tight" : "text-sm leading-tight"}>
              {rankName}
            </div>
            <div className={small ? "text-xs leading-tight" : "text-sm leading-tight"}>
              {suitSymbol}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
