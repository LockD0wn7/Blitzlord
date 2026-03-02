import { useCallback } from "react";
import { useGameStore } from "../../store/useGameStore";
import { getSocket } from "../../socket";

interface ActionBarProps {
  isMyTurn: boolean;
  canPass: boolean;
}

export default function ActionBar({ isMyTurn, canPass }: ActionBarProps) {
  const selectedCards = useGameStore((s) => s.selectedCards);
  const clearSelection = useGameStore((s) => s.clearSelection);
  const setErrorMessage = useGameStore((s) => s.setErrorMessage);

  const handlePlay = useCallback(() => {
    if (selectedCards.length === 0) return;
    const socket = getSocket();
    socket.emit("game:playCards", { cards: selectedCards }, (res) => {
      if (res.ok) {
        // 手牌移除由 game:cardsPlayed 广播统一处理，此处仅清除选择
        clearSelection();
      } else {
        setErrorMessage(res.error || "出牌失败");
      }
    });
  }, [selectedCards, clearSelection, setErrorMessage]);

  const handlePass = useCallback(() => {
    const socket = getSocket();
    socket.emit("game:pass", (res) => {
      if (!res.ok) {
        setErrorMessage(res.error || "不出失败");
      }
    });
  }, [setErrorMessage]);

  return (
    <div className="flex items-center justify-center gap-4 mt-4">
      <button
        onClick={handlePass}
        disabled={!isMyTurn || !canPass}
        className="px-6 py-2 rounded-lg font-bold transition-colors bg-gray-600 text-white hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
      >
        不出
      </button>
      <button
        onClick={handlePlay}
        disabled={!isMyTurn || selectedCards.length === 0}
        className="px-8 py-2 rounded-lg font-bold transition-colors bg-yellow-500 text-green-900 hover:bg-yellow-400 disabled:bg-green-700 disabled:text-green-500 disabled:cursor-not-allowed"
      >
        出牌
      </button>
    </div>
  );
}
