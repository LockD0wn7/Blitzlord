import type { MouseEvent } from "react";
import { getDisplayCardsForCards, Rank } from "@blitzlord/shared";
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
  [Rank.BlackJoker]: "\u5c0f\u738b",
  [Rank.RedJoker]: "\u5927\u738b",
};

function formatAction(entry: TrackerHistoryEntry): string {
  return entry.action === "pass" ? "\u4e0d\u51fa" : "\u51fa\u724c";
}

function formatPlayerName(
  playerId: string,
  playerNames: Record<string, string>,
): string {
  return playerNames[playerId] ?? "\u73a9\u5bb6";
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
        aria-label={"\u8bb0\u724c\u5668"}
        aria-modal="true"
        role="dialog"
      >
        <div className="tracker-panel__glow" />

        <header className="tracker-panel__header">
          <div>
            <p className="tracker-panel__eyebrow">Private Ledger</p>
            <h2 className="tracker-panel__title">{"\u8bb0\u724c\u5668"}</h2>
          </div>
          <button
            type="button"
            className="tracker-panel__close"
            onClick={onClose}
            aria-label={"\u5173\u95ed\u8bb0\u724c\u5668"}
          >
            {"\u5173\u95ed"}
          </button>
        </header>

        <div className="tracker-panel__body">
          <section className="tracker-panel__section">
            <div className="tracker-panel__sectionHead">
              <span className="tracker-panel__sectionLabel">
                {"\u5bf9\u624b\u4f59\u724c\u70b9\u6570\u8c31"}
              </span>
              <span className="tracker-panel__sectionMeta">
                {remainingByRank.length} {"\u4e2a\u70b9\u6570"}
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
                      <span className="ml-1 text-[0.6rem] text-yellow-400">
                        {"\u8d56"}
                      </span>
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
                    <span>
                      {"\u5df2\u51fa"} {entry.playedCopies}
                    </span>
                    <span>
                      {"\u6211\u624b"} {entry.myCopies}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="tracker-panel__section tracker-panel__section--history">
            <div className="tracker-panel__sectionHead">
              <span className="tracker-panel__sectionLabel">
                {"\u51fa\u724c\u724c\u8c31"}
              </span>
              <span className="tracker-panel__sectionMeta">
                {history.length} {"\u6761\u516c\u5f00\u52a8\u4f5c"}
              </span>
            </div>

            <div className="tracker-history">
              {history.length === 0 ? (
                <div className="tracker-history__empty">
                  {"\u672c\u5c40\u8fd8\u6ca1\u6709\u516c\u5f00\u52a8\u4f5c"}
                </div>
              ) : (
                history.map((entry, index) => (
                  <div key={entry.sequence}>
                    {(index === 0 || history[index - 1]?.round !== entry.round) && (
                      <div className="tracker-history__round">
                        <span>{"\u65b0\u4e00\u8f6e"}</span>
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
                          {getDisplayCardsForCards(entry.cards, wildcardRank).map(
                            (card, cardIndex) => (
                              <div
                                key={`${entry.sequence}-${card.rank}-${card.suit}-${cardIndex}`}
                                className="tracker-history__card"
                              >
                                <CardComponent
                                  card={card}
                                  small
                                  isWildcard={card.isWildcard}
                                />
                              </div>
                            ),
                          )}
                        </div>
                      ) : entry.action === "pass" ? (
                        <div className="tracker-history__passNote">
                          {"\u653e\u5f03\u8ddf\u724c\uff0c\u70b9\u6570\u7edf\u8ba1\u4e0d\u53d8"}
                        </div>
                      ) : (
                        <div className="tracker-history__passNote">
                          {"\u5df2\u5e7f\u64ad\u51fa\u724c"}
                        </div>
                      )}
                    </article>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
