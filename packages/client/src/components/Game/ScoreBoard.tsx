import { useNavigate, useParams } from "react-router-dom";
import { useGameStore } from "../../store/useGameStore";
import { PlayerRole } from "@blitzlord/shared";

export default function ScoreBoard() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const gameResult = useGameStore((s) => s.gameResult);
  const players = useGameStore((s) => s.players);
  const resetGame = useGameStore((s) => s.resetGame);

  if (!gameResult) return null;

  const { winnerId, winnerRole, scores } = gameResult;
  const winnerName =
    players.find((p) => p.playerId === winnerId)?.playerName || "玩家";

  // 获取一个 scoreDetail 来显示倍率明细（所有人倍率一样，只是正负不同）
  const sampleScore = Object.values(scores)[0];

  const handleBackToRoom = () => {
    resetGame();
    navigate(`/room/${roomId}`);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-green-800 rounded-2xl shadow-2xl p-8 w-full max-w-md">
        {/* 标题 */}
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-yellow-400 mb-2">
            游戏结束
          </h2>
          <p className="text-white text-lg">
            {winnerName}{" "}
            <span className="text-yellow-300">
              ({winnerRole === PlayerRole.Landlord ? "地主" : "农民"})
            </span>{" "}
            获胜！
          </p>
        </div>

        {/* 倍率明细 */}
        {sampleScore && (
          <div className="bg-green-700/50 rounded-lg p-4 mb-6 border border-green-600/50">
            <h3 className="text-green-200 font-semibold mb-3">倍率明细</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-green-300">叫分倍率</span>
              <span className="text-white text-right">
                x{sampleScore.baseBid}
              </span>
              <span className="text-green-300">炸弹数</span>
              <span className="text-white text-right">
                {sampleScore.bombCount} (x
                {Math.pow(2, sampleScore.bombCount)})
              </span>
              <span className="text-green-300">火箭</span>
              <span className="text-white text-right">
                {sampleScore.rocketUsed ? "是 (x2)" : "否"}
              </span>
              <span className="text-green-300">春天</span>
              <span className="text-white text-right">
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
                className={`flex items-center justify-between rounded-lg px-4 py-2 ${
                  isWinner
                    ? "bg-yellow-500/20 border border-yellow-400/50"
                    : "bg-green-700/30 border border-green-600/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">
                    {player.playerName}
                  </span>
                  {player.role === PlayerRole.Landlord && (
                    <span className="text-yellow-400 text-xs">[地主]</span>
                  )}
                </div>
                <span
                  className={`font-bold text-lg ${
                    score.finalScore > 0 ? "text-green-300" : "text-red-400"
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
          className="w-full py-3 rounded-lg font-bold text-lg transition-colors bg-yellow-500 text-green-900 hover:bg-yellow-400"
        >
          再来一局
        </button>
      </div>
    </div>
  );
}
