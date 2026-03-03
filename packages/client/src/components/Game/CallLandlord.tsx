import { useCallback } from "react";
import { useGameStore } from "../../store/useGameStore";
import { getSocket } from "../../socket";

interface CallLandlordProps {
  isMyTurn: boolean;
}

export default function CallLandlord({ isMyTurn }: CallLandlordProps) {
  const callSequence = useGameStore((s) => s.callSequence);
  const setErrorMessage = useGameStore((s) => s.setErrorMessage);

  // 找到当前最高叫分
  const maxBid = callSequence.reduce(
    (max, record) => Math.max(max, record.bid),
    0
  );

  const handleBid = useCallback(
    (bid: 0 | 1 | 2 | 3) => {
      const socket = getSocket();
      socket.emit("game:callLandlord", { bid }, (res) => {
        if (!res.ok) {
          setErrorMessage(res.error || "叫分失败");
        }
      });
    },
    [setErrorMessage]
  );

  return (
    <div className="flex flex-col items-center gap-4 animate-fade-in">
      <h3 className="text-gold font-cn font-bold text-lg">请叫分</h3>
      <div className="flex items-center gap-3">
        <button
          onClick={() => handleBid(0)}
          disabled={!isMyTurn}
          className="btn-ghost px-5 py-2 rounded-lg font-bold"
        >
          不叫
        </button>
        {([1, 2, 3] as const).map((bid) => (
          <button
            key={bid}
            onClick={() => handleBid(bid)}
            disabled={!isMyTurn || bid <= maxBid}
            className="btn-gold px-5 py-2 rounded-lg"
          >
            {bid} 分
          </button>
        ))}
      </div>
      {/* 叫分记录 */}
      {callSequence.length > 0 && (
        <div className="flex gap-4 text-sm text-muted mt-2">
          {callSequence.map((record, i) => (
            <span key={i} className={record.bid > 0 ? "text-gold" : ""}>
              {record.bid === 0 ? "不叫" : `${record.bid} 分`}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
