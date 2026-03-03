import { PlayerRole } from "@blitzlord/shared";

interface OpponentAreaProps {
  playerName: string;
  cardCount: number;
  role: PlayerRole | null;
  isOnline: boolean;
  isCurrentTurn: boolean;
  position: "left" | "right";
}

function roleLabel(role: PlayerRole | null): string | null {
  if (role === PlayerRole.Landlord) return "地主";
  if (role === PlayerRole.Peasant) return "农民";
  return null;
}

export default function OpponentArea({
  playerName,
  cardCount,
  role,
  isOnline,
  isCurrentTurn,
  position,
}: OpponentAreaProps) {
  const label = roleLabel(role);

  return (
    <div
      className={`flex flex-col items-center gap-2 ${
        position === "left" ? "mr-auto" : "ml-auto"
      }`}
    >
      {/* 玩家信息 */}
      <div
        className={`rounded-xl px-4 py-3 text-center min-w-28 backdrop-blur-md transition-all duration-300 ${
          isCurrentTurn
            ? "bg-gold/10 border-2 border-gold/50 shadow-[0_0_20px_rgba(201,165,78,0.15)]"
            : "bg-surface/50 border border-surface-border/40"
        }`}
      >
        <div className="flex items-center justify-center gap-2 mb-1">
          <span
            className={`w-2 h-2 rounded-full ${
              isOnline ? "bg-jade" : "bg-crimson"
            }`}
          />
          <span className="text-warm font-medium text-sm truncate max-w-20">
            {playerName}
          </span>
        </div>
        {label && (
          <div
            className={`text-xs font-bold ${
              role === PlayerRole.Landlord ? "text-gold" : "text-jade"
            }`}
          >
            {label}
          </div>
        )}
      </div>

      {/* 牌数 */}
      <div className="flex items-center gap-1.5">
        <div className="w-6 h-8 bg-gradient-to-br from-card-back to-card-back-dim rounded border border-card-back-border/60 shadow-sm" />
        <span className="text-warm font-bold text-lg">{cardCount}</span>
      </div>
    </div>
  );
}
