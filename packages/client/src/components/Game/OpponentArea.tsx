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

function roleColor(role: PlayerRole | null): string {
  if (role === PlayerRole.Landlord) return "text-yellow-400";
  return "text-blue-300";
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
        className={`rounded-xl px-4 py-3 text-center min-w-28 ${
          isCurrentTurn
            ? "bg-yellow-500/20 border-2 border-yellow-400"
            : "bg-green-700/60 border border-green-600/50"
        }`}
      >
        <div className="flex items-center justify-center gap-2 mb-1">
          <span
            className={`w-2 h-2 rounded-full ${
              isOnline ? "bg-green-400" : "bg-red-400"
            }`}
          />
          <span className="text-white font-medium text-sm truncate max-w-20">
            {playerName}
          </span>
        </div>
        {label && (
          <div className={`text-xs font-bold ${roleColor(role)}`}>
            {label}
          </div>
        )}
      </div>

      {/* 牌数 */}
      <div className="flex items-center gap-1">
        <div className="w-6 h-8 bg-blue-800 rounded border border-blue-600 shadow-sm" />
        <span className="text-white font-bold text-lg">{cardCount}</span>
      </div>
    </div>
  );
}
