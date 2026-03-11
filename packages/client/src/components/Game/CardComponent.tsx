import type { Card } from "@blitzlord/shared";
import { Rank, RANK_NAMES, SUIT_SYMBOLS, Suit } from "@blitzlord/shared";

interface CardComponentProps {
  card: Card;
  selected?: boolean;
  onClick?: () => void;
  small?: boolean;
  isWildcard?: boolean;
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
  isWildcard = false,
}: CardComponentProps) {
  const isJoker = card.rank === Rank.BlackJoker || card.rank === Rank.RedJoker;
  const color = getSuitColor(card.suit, card.rank);
  const rankName = RANK_NAMES[card.rank];
  const suitSymbol = card.suit ? SUIT_SYMBOLS[card.suit] : "";
  const className = [
    "card-shell",
    small ? "card-shell--small" : "card-shell--hand",
    selected ? "card-shell--selected" : "",
    isWildcard ? "card-shell--wildcard" : "",
    onClick ? "card-shell--interactive" : "",
    isJoker ? "card-shell--joker" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className} onClick={onClick}>
      {isWildcard && <span className="card-shell__badge">{"\u8d56"}</span>}

      {isJoker ? (
        <div className={`card-shell__joker ${color}`}>
          <span className="card-shell__jokerMark">J</span>
          <span className="card-shell__jokerLabel">{rankName}</span>
        </div>
      ) : (
        <>
          <div className={`card-shell__corner card-shell__corner--top ${color}`}>
            <div className="card-shell__rank">{rankName}</div>
            <div className="card-shell__suit">{suitSymbol}</div>
          </div>

          <div className={`card-shell__sigil ${color}`} aria-hidden="true">
            {suitSymbol}
          </div>

          <div className={`card-shell__corner card-shell__corner--bottom ${color}`}>
            <div className="card-shell__rank">{rankName}</div>
            <div className="card-shell__suit">{suitSymbol}</div>
          </div>
        </>
      )}
    </div>
  );
}
