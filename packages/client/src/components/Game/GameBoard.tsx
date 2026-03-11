import { useEffect, useMemo } from "react";
import { useDoudizhuGameStore } from "../../games/doudizhu/store/useDoudizhuGameStore";
import { useSocketStore } from "../../store/useSocketStore";
import { getSocket, connectSocket, emitMatchRequestSync } from "../../socket";
import {
  GamePhase,
  PlayerRole,
  RANK_NAMES,
} from "@blitzlord/shared";
import type {
  GameSnapshot,
  ScoreDetail,
} from "@blitzlord/shared";
import { isDoudizhuSnapshot } from "@blitzlord/shared/games/doudizhu";
import PlayerHand from "./PlayerHand";
import OpponentArea from "./OpponentArea";
import PlayedCards from "./PlayedCards";
import ActionBar from "./ActionBar";
import CallLandlord from "./CallLandlord";
import ScoreBoard from "./ScoreBoard";
import CardComponent from "./CardComponent";
import CardTrackerPanel from "./CardTrackerPanel";

interface GameBoardProps {
  roomId: string;
}

export default function GameBoard({ roomId }: GameBoardProps) {
  const token =
    useSocketStore((s) => s.token) || localStorage.getItem("playerId") || "";

  const phase = useDoudizhuGameStore((s) => s.phase);
  const myRole = useDoudizhuGameStore((s) => s.myRole);
  const currentTurn = useDoudizhuGameStore((s) => s.currentTurn);
  const lastPlay = useDoudizhuGameStore((s) => s.lastPlay);
  const bottomCards = useDoudizhuGameStore((s) => s.bottomCards);
  const baseBid = useDoudizhuGameStore((s) => s.baseBid);
  const bombCount = useDoudizhuGameStore((s) => s.bombCount);
  const rocketUsed = useDoudizhuGameStore((s) => s.rocketUsed);
  const players = useDoudizhuGameStore((s) => s.players);
  const tracker = useDoudizhuGameStore((s) => s.tracker);
  const isTrackerOpen = useDoudizhuGameStore((s) => s.isTrackerOpen);
  const wildcardRank = useDoudizhuGameStore((s) => s.wildcardRank);
  const gameResult = useDoudizhuGameStore((s) => s.gameResult);
  const errorMessage = useDoudizhuGameStore((s) => s.errorMessage);
  const setErrorMessage = useDoudizhuGameStore((s) => s.setErrorMessage);
  const toggleTrackerPanel = useDoudizhuGameStore((s) => s.toggleTrackerPanel);

  useEffect(() => {
    connectSocket();
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const onSyncState = (snapshot: GameSnapshot) => {
      if (!isDoudizhuSnapshot(snapshot)) {
        useDoudizhuGameStore.getState().setErrorMessage("收到不支持的游戏快照");
        return;
      }

      useDoudizhuGameStore.getState().syncState(snapshot);
    };

    const onEnded = (data: {
      winnerId: string;
      winnerRole: PlayerRole;
      scores: Record<string, ScoreDetail>;
    }) => {
      const store = useDoudizhuGameStore.getState();
      store.setPhase(GamePhase.Ended);
      store.setGameResult(data);
    };

    const onPlayerDisconnected = (data: { playerId: string }) => {
      useDoudizhuGameStore.getState().setPlayerOnline(data.playerId, false);
    };

    const onPlayerReconnected = (data: { playerId: string }) => {
      useDoudizhuGameStore.getState().setPlayerOnline(data.playerId, true);
    };

    const onError = (data: { message: string }) => {
      useDoudizhuGameStore.getState().setErrorMessage(data.message);
    };

    socket.on("match:syncState", onSyncState);
    socket.on("match:ended", onEnded);
    socket.on("player:disconnected", onPlayerDisconnected);
    socket.on("player:reconnected", onPlayerReconnected);
    socket.on("error", onError);
    emitMatchRequestSync();

    return () => {
      socket.off("match:syncState", onSyncState);
      socket.off("match:ended", onEnded);
      socket.off("player:disconnected", onPlayerDisconnected);
      socket.off("player:reconnected", onPlayerReconnected);
      socket.off("error", onError);
    };
  }, [roomId]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage, setErrorMessage]);

  const opponents = useMemo(() => {
    const myIndex = players.findIndex((player) => player.playerId === token);

    if (myIndex === -1) {
      return { left: null, right: null };
    }

    return {
      left: players[(myIndex + 1) % 3] ?? null,
      right: players[(myIndex + 2) % 3] ?? null,
    };
  }, [players, token]);

  const playerNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const player of players) {
      map[player.playerId] = player.playerName;
    }
    return map;
  }, [players]);

  const trackerHistory = useMemo(
    () => [...tracker.history].reverse(),
    [tracker.history],
  );
  const lastPassPlayerId = useMemo(() => {
    const latestEntry = tracker.history.at(-1);
    if (!latestEntry || latestEntry.action !== "pass" || lastPlay === null) {
      return null;
    }

    return latestEntry.playerId;
  }, [lastPlay, tracker.history]);
  const isMyTurn = currentTurn === token;
  const canPass =
    phase === GamePhase.Playing &&
    isMyTurn &&
    lastPlay !== null &&
    lastPlay.playerId !== token;

  return (
    <div className="game-table-bg relative flex min-h-screen flex-col overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_50%,_transparent_30%,_rgba(9,13,25,0.6)_100%)]" />

      {errorMessage && (
        <div className="animate-slide-down absolute top-4 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-crimson/90 px-6 py-2.5 text-sm text-warm shadow-lg backdrop-blur-md">
          {errorMessage}
        </div>
      )}

      <div className="relative z-10 flex items-center justify-between border-b border-surface-border/30 bg-surface/50 px-5 py-2.5 backdrop-blur-md">
        <div className="text-sm text-muted">房间: {roomId}</div>

        <div className="flex items-center gap-4 text-sm">
          {baseBid > 0 && (
            <span className="font-medium text-gold">叫分: {baseBid}</span>
          )}
          {bombCount > 0 && (
            <span className="font-medium text-orange-400">炸弹: {bombCount}</span>
          )}
          {rocketUsed && <span className="font-bold text-crimson">火箭!</span>}
          {wildcardRank !== null && (
            <span className="font-semibold text-yellow-400">
              赖子: {RANK_NAMES[wildcardRank]}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div
            className={`text-sm font-cn font-semibold ${
              myRole === PlayerRole.Landlord
                ? "text-gold"
                : myRole === PlayerRole.Peasant
                ? "text-jade"
                : "text-muted"
            }`}
          >
            {myRole === PlayerRole.Landlord
              ? "地主"
              : myRole === PlayerRole.Peasant
              ? "农民"
              : ""}
          </div>

          {(phase === GamePhase.Playing || phase === GamePhase.Ended) && (
            <button
              type="button"
              onClick={toggleTrackerPanel}
              className="rounded-full border border-gold/25 bg-base/35 px-3 py-1.5 text-left backdrop-blur-md transition-all duration-200 hover:border-gold/55 hover:bg-gold/10 hover:shadow-[0_0_24px_rgba(201,165,78,0.15)]"
            >
              <span className="block font-display text-[0.58rem] uppercase tracking-[0.24em] text-gold-light/75">
                Ledger
              </span>
              <span className="block font-cn text-xs font-semibold text-gold">
                记牌器
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="relative z-10 flex justify-between px-8 pt-4 pb-2">
        {opponents.left && (
          <OpponentArea
            playerName={opponents.left.playerName}
            cardCount={opponents.left.cardCount}
            role={opponents.left.role}
            isOnline={opponents.left.isOnline}
            isCurrentTurn={currentTurn === opponents.left.playerId}
            position="left"
          />
        )}

        {opponents.right && (
          <OpponentArea
            playerName={opponents.right.playerName}
            cardCount={opponents.right.cardCount}
            role={opponents.right.role}
            isOnline={opponents.right.isOnline}
            isCurrentTurn={currentTurn === opponents.right.playerId}
            position="right"
          />
        )}
      </div>

      {bottomCards.length > 0 && (
        <div className="relative z-10 flex items-center justify-center gap-1 py-1.5">
          <span className="mr-2 text-xs text-muted">底牌:</span>
          {bottomCards.map((card, index) => (
            <CardComponent
              key={`bottom-${card.rank}-${card.suit}-${index}`}
              card={card}
              small
            />
          ))}
        </div>
      )}

      <div className="relative z-10 flex flex-1 items-center justify-center px-8">
        {phase === GamePhase.Calling ? (
          <CallLandlord isMyTurn={isMyTurn} />
        ) : phase === GamePhase.Playing || phase === GamePhase.Ended ? (
          <PlayedCards
            lastPlay={lastPlay}
            lastPassPlayerId={lastPassPlayerId}
            playerNames={playerNames}
            wildcardRank={wildcardRank}
          />
        ) : (
          <div className="text-lg text-muted font-cn">等待游戏开始...</div>
        )}
      </div>

      <div className="relative z-10 px-4 pb-4">
        {isMyTurn && phase === GamePhase.Playing && (
          <div className="mb-2 text-center">
            <span className="animate-glow-pulse inline-block rounded-full border border-gold/30 bg-gold/10 px-5 py-1 text-sm font-bold text-gold font-cn">
              轮到你出牌
            </span>
          </div>
        )}

        {phase === GamePhase.Playing && (
          <ActionBar isMyTurn={isMyTurn} canPass={canPass} />
        )}

        <div className="mt-3">
          <PlayerHand />
        </div>
      </div>

      {phase === GamePhase.Ended && gameResult && <ScoreBoard />}

      <CardTrackerPanel
        open={isTrackerOpen}
        onClose={toggleTrackerPanel}
        remainingByRank={tracker.remainingByRank}
        history={trackerHistory}
        playerNames={playerNames}
        wildcardRank={wildcardRank}
      />
    </div>
  );
}
