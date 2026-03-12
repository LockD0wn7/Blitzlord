import { useNavigate, useParams } from "react-router-dom";
import { useDoudizhuGameStore } from "../../games/doudizhu/store/useDoudizhuGameStore";
import { useRoomStore } from "../../store/useRoomStore";
import { PlayerRole } from "@blitzlord/shared";

export default function ScoreBoard() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const gameResult = useDoudizhuGameStore((s) => s.gameResult);
  const players = useDoudizhuGameStore((s) => s.players);
  const resetGame = useDoudizhuGameStore((s) => s.resetGame);
  const setCurrentRoom = useRoomStore((s) => s.setCurrentRoom);

  if (!gameResult) return null;

  const { winnerId, winnerRole, scores } = gameResult;
  const winnerPlayer = players.find((p) => p.playerId === winnerId);
  const winnerName = winnerPlayer
    ? winnerPlayer.playerType === "bot" ? `${winnerPlayer.playerName} [BOT]` : winnerPlayer.playerName
    : "Player";

  // 获取一个 scoreDetail 来显示倍率明细（所有人倍率一样，只是正负不同）
  const sampleScore = Object.values(scores)[0];

  const handleBackToRoom = () => {
    resetGame();
    setCurrentRoom(null);
    navigate(`/room/${roomId}`);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-surface/95 backdrop-blur-xl rounded-2xl border border-surface-border/60 shadow-[0_8px_40px_rgba(0,0,0,0.5)] p-8 w-full max-w-md animate-slide-up">
        {/* 标题 */}
        <div className="text-center mb-6">
          <h2 className="font-cn text-3xl font-bold text-gold-light mb-2">
            游戏结束
          </h2>
          <p className="text-warm text-lg">
            {winnerName}{" "}
            <span className="text-gold">
              ({winnerRole === PlayerRole.Landlord ? "地主" : "农民"})
            </span>{" "}
            获胜！
          </p>
        </div>

        {/* 倍率明细 */}
        {sampleScore && (
          <div className="bg-base-light/50 rounded-xl p-4 mb-6 border border-surface-border/40">
            <h3 className="text-warm-muted font-cn font-semibold mb-3">倍率明细</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted">叫分倍率</span>
              <span className="text-warm text-right">
                x{sampleScore.baseBid}
              </span>
              <span className="text-muted">炸弹数</span>
              <span className="text-warm text-right">
                {sampleScore.bombCount} (x
                {Math.pow(2, sampleScore.bombCount)})
              </span>
              <span className="text-muted">火箭</span>
              <span className="text-warm text-right">
                {sampleScore.rocketUsed ? "是 (x2)" : "否"}
              </span>
              <span className="text-muted">春天</span>
              <span className="text-warm text-right">
                {sampleScore.isSpring ? "是 (x2)" : "否"}
              </span>
            </div>
          </div>
        )}

        {/* 各玩家得分 */}
        <div className="space-y-2 mb-6">
          {players.map((player) => {
            const score = scores[player.playerId];
            if (!score) return null;
            const isWinner = player.playerId === winnerId;
            return (
              <div
                key={player.playerId}
                className={`flex items-center justify-between rounded-xl px-4 py-2.5 border transition-all ${
                  isWinner
                    ? "bg-gold/10 border-gold/30"
                    : "bg-base-light/30 border-surface-border/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-warm font-medium">
                    {player.playerType === "bot" ? `${player.playerName} [BOT]` : player.playerName}
                  </span>
                  {player.role === PlayerRole.Landlord && (
                    <span className="text-gold text-xs font-bold">[地主]</span>
                  )}
                </div>
                <span
                  className={`font-bold text-lg ${
                    score.finalScore > 0 ? "text-jade" : score.finalScore < 0 ? "text-crimson" : "text-warm"
                  }`}
                >
                  {score.finalScore > 0 ? "+" : ""}
                  {score.finalScore}
                </span>
              </div>
            );
          })}
        </div>

        {/* 再来一局 */}
        <button
          onClick={handleBackToRoom}
          className="btn-gold w-full py-3 rounded-xl text-lg"
        >
          再来一局
        </button>
      </div>
    </div>
  );
}
