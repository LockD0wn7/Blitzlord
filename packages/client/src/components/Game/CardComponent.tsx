import type { Card } from "@blitzlord/shared";
import { Suit, Rank, RANK_NAMES, SUIT_SYMBOLS } from "@blitzlord/shared";

interface CardComponentProps {
  card: Card;
  selected?: boolean;
  onClick?: () => void;
  small?: boolean;
}

function getSuitColor(suit: Suit | null, rank: Rank): string {
  if (rank === Rank.RedJoker) return "text-card-red";
  if (rank === Rank.BlackJoker) return "text-card-black";
  if (suit === Suit.Heart || suit === Suit.Diamond) return "text-card-red";
  return "text-card-black";
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
        bg-gradient-to-br from-card to-card-dim
        rounded-lg border border-card-border/60
        select-none transition-all duration-200 ease-out
        ${small ? "w-10 h-14 text-xs" : "w-14 h-20 text-sm"}
        ${
          selected
            ? "-translate-y-3 shadow-[0_4px_12px_rgba(0,0,0,0.25)] ring-2 ring-gold/80"
            : "shadow-[0_2px_6px_rgba(0,0,0,0.15),_0_6px_16px_rgba(0,0,0,0.08)]"
        }
        ${
          onClick
            ? "cursor-pointer hover:-translate-y-1 hover:shadow-[0_4px_12px_rgba(0,0,0,0.2),_0_10px_24px_rgba(0,0,0,0.12)]"
            : ""
        }
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
              small ? "ml-0.5 mt-0.5" : "ml-1.5 mt-1"
            }`}
          >
            <div className={`${small ? "text-xs" : "text-sm"} leading-tight`}>
              {rankName}
            </div>
            <div className={`${small ? "text-xs" : "text-sm"} leading-tight`}>
              {suitSymbol}
            </div>
          </div>
          <div
            className={`absolute bottom-0 right-0 ${color} font-bold rotate-180 ${
              small ? "mr-0.5 mb-0.5" : "mr-1.5 mb-1"
            }`}
          >
            <div className={`${small ? "text-xs" : "text-sm"} leading-tight`}>
              {rankName}
            </div>
            <div className={`${small ? "text-xs" : "text-sm"} leading-tight`}>
              {suitSymbol}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
