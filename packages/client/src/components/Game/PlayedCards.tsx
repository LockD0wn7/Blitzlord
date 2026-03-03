import type { CardPlay } from "@blitzlord/shared";
import CardComponent from "./CardComponent";

interface PlayedCardsProps {
  lastPlay: { playerId: string; play: CardPlay } | null;
  lastPassPlayerId: string | null;
  playerNames: Record<string, string>;
}

export default function PlayedCards({
  lastPlay,
  lastPassPlayerId,
  playerNames,
}: PlayedCardsProps) {
  if (lastPassPlayerId) {
    const name = playerNames[lastPassPlayerId] || "玩家";
    return (
      <div className="flex flex-col items-center gap-2 animate-fade-in">
        <span className="text-muted text-sm">{name}</span>
        <span className="text-warm-muted text-xl font-cn font-bold">不出</span>
      </div>
    );
  }

  if (!lastPlay) {
    return (
      <div className="flex items-center justify-center h-24">
        <span className="text-muted text-sm">等待出牌...</span>
      </div>
    );
  }

  const name = playerNames[lastPlay.playerId] || "玩家";

  return (
    <div className="flex flex-col items-center gap-2 animate-fade-in">
      <span className="text-muted text-sm">{name}</span>
      <div className="flex items-end flex-wrap justify-center gap-0">
        {lastPlay.play.cards.map((card, index) => (
          <div
            key={`${card.rank}-${card.suit}-${index}`}
            className="-ml-1 first:ml-0"
          >
            <CardComponent card={card} small />
          </div>
        ))}
      </div>
    </div>
  );
}
