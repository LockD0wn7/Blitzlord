import { useCallback } from "react";
import { useDoudizhuGameStore } from "../../games/doudizhu/store/useDoudizhuGameStore";
import { useSocketStore } from "../../store/useSocketStore";
import { emitMatchAction } from "../../socket";
import { resolveHintAction } from "./hintAction";

interface ActionBarProps {
  isMyTurn: boolean;
  canPass: boolean;
}

export default function ActionBar({ isMyTurn, canPass }: ActionBarProps) {
  const token =
    useSocketStore((s) => s.token) || localStorage.getItem("playerId") || "";
  const myHand = useDoudizhuGameStore((s) => s.myHand);
  const currentTurn = useDoudizhuGameStore((s) => s.currentTurn);
  const lastPlay = useDoudizhuGameStore((s) => s.lastPlay);
  const selectedCards = useDoudizhuGameStore((s) => s.selectedCards);
  const hintContextKey = useDoudizhuGameStore((s) => s.hintContextKey);
  const hintCursor = useDoudizhuGameStore((s) => s.hintCursor);
  const wildcardRank = useDoudizhuGameStore((s) => s.wildcardRank);
  const applyHintSelection = useDoudizhuGameStore((s) => s.applyHintSelection);
  const clearSelection = useDoudizhuGameStore((s) => s.clearSelection);
  const setErrorMessage = useDoudizhuGameStore((s) => s.setErrorMessage);

  const handlePlay = useCallback(() => {
    if (selectedCards.length === 0) return;
    emitMatchAction({ type: "playCards", cards: selectedCards }, (res) => {
      if (res.ok) {
        // 手牌更新统一由 match:syncState 快照驱动，这里只清空当前选择
        clearSelection();
      } else {
        setErrorMessage(res.error || "出牌失败");
      }
    });
  }, [selectedCards, clearSelection, setErrorMessage]);

  const handleHint = useCallback(() => {
    const result = resolveHintAction({
      isMyTurn,
      token,
      myHand,
      currentTurn,
      lastPlay,
      hintContextKey,
      hintCursor,
      wildcardRank,
    });

    if (result.type === "noop") {
      return;
    }

    if (result.type === "error") {
      setErrorMessage(result.message);
      return;
    }

    applyHintSelection(result.cards, result.contextKey, result.nextCursor);
    setErrorMessage(null);
  }, [
    applyHintSelection,
    currentTurn,
    hintContextKey,
    hintCursor,
    isMyTurn,
    lastPlay,
    myHand,
    setErrorMessage,
    token,
    wildcardRank,
  ]);

  const handlePass = useCallback(() => {
    emitMatchAction({ type: "pass" }, (res) => {
      if (!res.ok) {
        setErrorMessage(res.error || "不出失败");
      }
    });
  }, [setErrorMessage]);

  return (
    <div className="flex items-center justify-center gap-4 mt-4">
      <button
        onClick={handleHint}
        disabled={!isMyTurn}
        className="btn-ghost px-6 py-2 rounded-lg font-bold"
      >
        提示
      </button>
      <button
        onClick={handlePass}
        disabled={!isMyTurn || !canPass}
        className="btn-ghost px-6 py-2 rounded-lg font-bold"
      >
        不出
      </button>
      <button
        onClick={handlePlay}
        disabled={!isMyTurn || selectedCards.length === 0}
        className="btn-gold px-8 py-2 rounded-lg"
      >
        出牌
      </button>
    </div>
  );
}
