import type { MouseEvent } from "react";
import { Rank } from "@blitzlord/shared";
import type {
  TrackerHistoryEntry,
  TrackerRankStat,
} from "@blitzlord/shared";
import CardComponent from "./CardComponent";

interface CardTrackerPanelProps {
  open: boolean;
  onClose: () => void;
  remainingByRank: TrackerRankStat[];
  history: TrackerHistoryEntry[];
  playerNames: Record<string, string>;
  wildcardRank?: Rank | null;
}

const KEY_RANKS = new Set<Rank>([
  Rank.RedJoker,
  Rank.BlackJoker,
  Rank.Two,
  Rank.Ace,
]);

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
  [Rank.BlackJoker]: "小王",
  [Rank.RedJoker]: "大王",
};

function formatAction(entry: TrackerHistoryEntry): string {
  return entry.action === "pass" ? "不出" : "出牌";
}

function formatPlayerName(
  playerId: string,
  playerNames: Record<string, string>,
): string {
  return playerNames[playerId] ?? "玩家";
}

function stopBubbling(event: MouseEvent<HTMLElement>) {
  event.stopPropagation();
}

export default function CardTrackerPanel({
  open,
  onClose,
  remainingByRank,
  history,
  playerNames,
  wildcardRank = null,
}: CardTrackerPanelProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="tracker-panel-overlay" onClick={onClose}>
      <aside
        className="tracker-panel"
        onClick={stopBubbling}
        aria-label="记牌器"
        aria-modal="true"
        role="dialog"
      >
        <div className="tracker-panel__glow" />

        <header className="tracker-panel__header">
          <div>
            <p className="tracker-panel__eyebrow">Private Ledger</p>
            <h2 className="tracker-panel__title">记牌器</h2>
          </div>
          <button
            type="button"
            className="tracker-panel__close"
            onClick={onClose}
            aria-label="关闭记牌器"
          >
            关闭
          </button>
        </header>

        <section className="tracker-panel__section">
          <div className="tracker-panel__sectionHead">
            <span className="tracker-panel__sectionLabel">对手余牌点数谱</span>
            <span className="tracker-panel__sectionMeta">
              {remainingByRank.length} 个点数
            </span>
          </div>

          <div className="tracker-rank-list">
            {remainingByRank.map((entry) => (
              <article
                key={entry.rank}
                className={`tracker-rank-card${
                  entry.remainingOpponentCopies === 0
                    ? " tracker-rank-card--empty"
                    : ""
                }${
                  KEY_RANKS.has(entry.rank)
                    ? " tracker-rank-card--key"
                    : ""
                }${
                  wildcardRank === entry.rank
                    ? " ring-2 ring-yellow-400"
                    : ""
                }`}
              >
                <div className="tracker-rank-card__label">
                  {RANK_LABELS[entry.rank]}
                  {wildcardRank === entry.rank && (
                    <span className="ml-1 text-yellow-400 text-[0.6rem]">赖</span>
                  )}
                </div>
                <div className="tracker-rank-card__pips" aria-hidden="true">
                  {Array.from({ length: entry.totalCopies }, (_, index) => (
                    <span
                      key={`${entry.rank}-${index}`}
                      className={`tracker-rank-card__pip${
                        index < entry.remainingOpponentCopies
                          ? " tracker-rank-card__pip--active"
                          : ""
                      }`}
                    />
                  ))}
                </div>
                <div className="tracker-rank-card__count">
                  {entry.remainingOpponentCopies}
                </div>
                <div className="tracker-rank-card__meta">
                  <span>已出 {entry.playedCopies}</span>
                  <span>我手 {entry.myCopies}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="tracker-panel__section tracker-panel__section--history">
          <div className="tracker-panel__sectionHead">
            <span className="tracker-panel__sectionLabel">出牌牌谱</span>
            <span className="tracker-panel__sectionMeta">
              {history.length} 条公开动作
            </span>
          </div>

          <div className="tracker-history">
            {history.length === 0 ? (
              <div className="tracker-history__empty">本局还没有公开动作</div>
            ) : (
              history.map((entry, index) => (
                <div key={entry.sequence}>
                  {(index === 0 || history[index - 1]?.round !== entry.round) && (
                    <div className="tracker-history__round">
                      <span>新一轮</span>
                      <span>Round {entry.round}</span>
                    </div>
                  )}

                  <article className="tracker-history__entry">
                    <div className="tracker-history__header">
                      <div className="tracker-history__badge">
                        R{entry.round} / #{entry.sequence}
                      </div>
                      <div className="tracker-history__player">
                        {formatPlayerName(entry.playerId, playerNames)}
                      </div>
                      <div
                        className={`tracker-history__action${
                          entry.action === "pass"
                            ? " tracker-history__action--pass"
                            : ""
                        }`}
                      >
                        {formatAction(entry)}
                      </div>
                    </div>

                    {entry.action === "play" && entry.cards.length > 0 ? (
                      <div className="tracker-history__cards">
                        {entry.cards.map((card, cardIndex) => (
                          <div
                            key={`${entry.sequence}-${card.rank}-${card.suit}-${cardIndex}`}
                            className="tracker-history__card"
                          >
                            <CardComponent card={card} small />
                          </div>
                        ))}
                      </div>
                    ) : entry.action === "pass" ? (
                      <div className="tracker-history__passNote">
                        放弃跟牌，点数统计不变
                      </div>
                    ) : (
                      <div className="tracker-history__passNote">已广播出牌</div>
                    )}
                  </article>
                </div>
              ))
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}
