import { Rank } from "@blitzlord/shared";
import type { TrackerRankStat } from "@blitzlord/shared";

interface CardTrackerBarProps {
  remainingByRank: TrackerRankStat[];
  wildcardRank: Rank | null;
  onOpenPanel: () => void;
  onUnpin: () => void;
}

const RANK_LABELS: Record<Rank, string> = {
  [Rank.Three]: "3",
  [Rank.Four]: "4",
  [Rank.Five]: "5",
  [Rank.Six]: "6",
  [Rank.Seven]: "7",
  [Rank.Eight]: "8",
  [Rank.Nine]: "9",
  [Rank.Ten]: "10",
  [Rank.Jack]: "J",
  [Rank.Queen]: "Q",
  [Rank.King]: "K",
  [Rank.Ace]: "A",
  [Rank.Two]: "2",
  [Rank.BlackJoker]: "小",
  [Rank.RedJoker]: "大",
};

const KEY_RANKS = new Set<Rank>([
  Rank.RedJoker,
  Rank.BlackJoker,
  Rank.Two,
  Rank.Ace,
]);

export default function CardTrackerBar({
  remainingByRank,
  wildcardRank,
  onOpenPanel,
  onUnpin,
}: CardTrackerBarProps) {
  if (remainingByRank.length === 0) {
    return null;
  }

  return (
    <div className="tracker-bar">
      <div className="tracker-bar__header">
        <span className="tracker-bar__title">记牌器</span>
        <div className="tracker-bar__actions">
          <button
            type="button"
            className="tracker-bar__btn"
            onClick={onOpenPanel}
            aria-label="展开详情"
            title="展开详情"
          >
            ↗
          </button>
          <button
            type="button"
            className="tracker-bar__btn"
            onClick={onUnpin}
            aria-label="取消常驻"
            title="取消常驻"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="tracker-bar__grid">
        {remainingByRank.map((entry) => {
          const isEmpty = entry.remainingOpponentCopies === 0;
          const isKey = KEY_RANKS.has(entry.rank);
          const isWild = wildcardRank === entry.rank;

          return (
            <div
              key={entry.rank}
              className={`tracker-bar__cell${
                isEmpty ? " tracker-bar__cell--empty" : ""
              }${isKey ? " tracker-bar__cell--key" : ""}${
                isWild ? " tracker-bar__cell--wild" : ""
              }`}
            >
              <span className="tracker-bar__rank">{RANK_LABELS[entry.rank]}</span>
              <span className="tracker-bar__count">
                {entry.remainingOpponentCopies}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
