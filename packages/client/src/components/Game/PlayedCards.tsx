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
  // R6: Pass 时同时显示 pass 信息和上一手牌
  if (lastPassPlayerId) {
    const passName = playerNames[lastPassPlayerId] || "玩家";
    return (
      <div className="flex flex-col items-center gap-2 animate-fade-in">
        <span className="text-warm-muted text-sm font-cn">{passName} 不出</span>
        {lastPlay && (
          <div className="flex flex-col items-center gap-1 opacity-70">
            <span className="text-muted text-xs">
              {playerNames[lastPlay.playerId] || "玩家"} 出的牌:
            </span>
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
        )}
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
