import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useGameStore } from "../../store/useGameStore";
import { useSocketStore } from "../../store/useSocketStore";
import { getSocket, connectSocket } from "../../socket";
import {
  GamePhase,
  PlayerRole,
  CardType,
  sortCards,
} from "@blitzlord/shared";
import type { Card, CardPlay, GameSnapshot, ScoreDetail } from "@blitzlord/shared";
import PlayerHand from "./PlayerHand";
import OpponentArea from "./OpponentArea";
import PlayedCards from "./PlayedCards";
import ActionBar from "./ActionBar";
import CallLandlord from "./CallLandlord";
import ScoreBoard from "./ScoreBoard";
import CardComponent from "./CardComponent";

export default function GameBoard() {
  const { roomId } = useParams<{ roomId: string }>();
  const token = useSocketStore((s) => s.token) || localStorage.getItem("playerId") || "";
  const [lastPassPlayerId, setLastPassPlayerId] = useState<string | null>(null);

  const phase = useGameStore((s) => s.phase);
  const myRole = useGameStore((s) => s.myRole);
  const currentTurn = useGameStore((s) => s.currentTurn);
  const lastPlay = useGameStore((s) => s.lastPlay);
  const bottomCards = useGameStore((s) => s.bottomCards);
  const baseBid = useGameStore((s) => s.baseBid);
  const bombCount = useGameStore((s) => s.bombCount);
  const rocketUsed = useGameStore((s) => s.rocketUsed);
  const players = useGameStore((s) => s.players);
  const gameResult = useGameStore((s) => s.gameResult);
  const errorMessage = useGameStore((s) => s.errorMessage);
  const setErrorMessage = useGameStore((s) => s.setErrorMessage);

  // 确保 socket 连接
  useEffect(() => {
    connectSocket();
  }, []);

  // 请求同步（重连恢复）
  useEffect(() => {
    const socket = getSocket();

    // 如果进入游戏页面没有 phase，说明需要同步
    if (!phase) {
      socket.emit("game:requestSync");
    }
  }, [phase]);

  // 监听所有 game:* 事件
  // 使用 useGameStore.getState() 避免闭包捕获过时的状态
  useEffect(() => {
    const socket = getSocket();

    const onSyncState = (snapshot: GameSnapshot) => {
      useGameStore.getState().syncState(snapshot);
      setLastPassPlayerId(null);
    };

    const onGameStarted = (data: {
      hand: Card[];
      firstCaller: string;
      players: { playerId: string; playerName: string; seatIndex: number }[];
    }) => {
      const store = useGameStore.getState();
      store.resetGame();
      store.setHand(sortCards(data.hand));
      store.setPhase(GamePhase.Calling);
      store.setCurrentTurn(data.firstCaller);
      store.setPlayers(
        data.players.map((p) => ({
          playerId: p.playerId,
          playerName: p.playerName,
          role: null,
          cardCount: 17,
          isOnline: true,
        }))
      );
      setLastPassPlayerId(null);
    };

    const onCallUpdate = (data: {
      playerId: string;
      bid: 0 | 1 | 2 | 3;
      nextCaller: string | null;
    }) => {
      const store = useGameStore.getState();
      store.addCallRecord({ playerId: data.playerId, bid: data.bid });
      store.setCurrentTurn(data.nextCaller);
    };

    const onLandlordDecided = (data: {
      landlordId: string;
      bottomCards: Card[];
      baseBid: 1 | 2 | 3;
    }) => {
      const store = useGameStore.getState();
      store.setBottomCards(data.bottomCards);
      store.setBaseBid(data.baseBid);
      store.setPhase(GamePhase.Playing);

      // 更新角色
      const currentPlayers = store.players;
      store.setPlayers(
        currentPlayers.map((p) => ({
          ...p,
          role:
            p.playerId === data.landlordId
              ? PlayerRole.Landlord
              : PlayerRole.Peasant,
          cardCount:
            p.playerId === data.landlordId ? 20 : p.cardCount,
        }))
      );

      // 如果我是地主，把底牌加入手牌
      if (data.landlordId === token) {
        store.setMyRole(PlayerRole.Landlord);
        store.setHand(sortCards([...store.myHand, ...data.bottomCards]));
      } else {
        store.setMyRole(PlayerRole.Peasant);
      }

      store.setCurrentTurn(data.landlordId);
    };

    const onTurnChanged = (data: { currentTurn: string }) => {
      useGameStore.getState().setCurrentTurn(data.currentTurn);
    };

    const onCardsPlayed = (data: {
      playerId: string;
      play: CardPlay;
      remainingCards: number;
    }) => {
      const store = useGameStore.getState();
      store.setLastPlay({ playerId: data.playerId, play: data.play });
      setLastPassPlayerId(null);
      store.updatePlayerCardCount(data.playerId, data.remainingCards);

      // 更新炸弹/火箭计数
      if (data.play.type === CardType.Bomb) {
        store.setBombCount(store.bombCount + 1);
      }
      if (data.play.type === CardType.Rocket) {
        store.setRocketUsed(true);
      }

      // 自己出的牌：通过广播统一从手牌移除（单一数据源）
      if (data.playerId === token) {
        store.removeCardsFromHand(data.play.cards);
      }

    };

    const onPassed = (data: { playerId: string }) => {
      setLastPassPlayerId(data.playerId);
    };

    const onEnded = (data: {
      winnerId: string;
      winnerRole: PlayerRole;
      scores: Record<string, ScoreDetail>;
    }) => {
      const store = useGameStore.getState();
      store.setPhase(GamePhase.Ended);
      store.setGameResult(data);
    };

    const onPlayerDisconnected = (data: { playerId: string }) => {
      useGameStore.getState().setPlayerOnline(data.playerId, false);
    };

    const onPlayerReconnected = (data: { playerId: string }) => {
      useGameStore.getState().setPlayerOnline(data.playerId, true);
    };

    const onError = (data: { message: string }) => {
      useGameStore.getState().setErrorMessage(data.message);
    };

    socket.on("game:syncState", onSyncState);
    socket.on("game:started", onGameStarted);
    socket.on("game:callUpdate", onCallUpdate);
    socket.on("game:landlordDecided", onLandlordDecided);
    socket.on("game:turnChanged", onTurnChanged);
    socket.on("game:cardsPlayed", onCardsPlayed);
    socket.on("game:passed", onPassed);
    socket.on("game:ended", onEnded);
    socket.on("player:disconnected", onPlayerDisconnected);
    socket.on("player:reconnected", onPlayerReconnected);
    socket.on("error", onError);

    return () => {
      socket.off("game:syncState", onSyncState);
      socket.off("game:started", onGameStarted);
      socket.off("game:callUpdate", onCallUpdate);
      socket.off("game:landlordDecided", onLandlordDecided);
      socket.off("game:turnChanged", onTurnChanged);
      socket.off("game:cardsPlayed", onCardsPlayed);
      socket.off("game:passed", onPassed);
      socket.off("game:ended", onEnded);
      socket.off("player:disconnected", onPlayerDisconnected);
      socket.off("player:reconnected", onPlayerReconnected);
      socket.off("error", onError);
    };
  }, [token]);

  // 自动清除错误提示
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage, setErrorMessage]);

  // 计算对手位置
  const opponents = useMemo(() => {
    const myIndex = players.findIndex((p) => p.playerId === token);
    if (myIndex === -1) return { left: null, right: null };
    const leftIndex = (myIndex + 1) % 3;
    const rightIndex = (myIndex + 2) % 3;
    return {
      left: players[leftIndex] || null,
      right: players[rightIndex] || null,
    };
  }, [players, token]);

  // 构建 playerNames 映射
  const playerNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of players) {
      map[p.playerId] = p.playerName;
    }
    return map;
  }, [players]);

  const isMyTurn = currentTurn === token;

  // 判断是否可以 pass（有上家牌且不是自己控牌时可以不出）
  const canPass =
    phase === GamePhase.Playing &&
    isMyTurn &&
    lastPlay !== null &&
    lastPlay.playerId !== token;

  return (
    <div className="min-h-screen bg-green-900 flex flex-col relative overflow-hidden">
      {/* 错误提示 */}
      {errorMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-2 rounded-lg shadow-lg animate-pulse">
          {errorMessage}
        </div>
      )}

      {/* 游戏信息栏 */}
      <div className="flex items-center justify-between px-4 py-2 bg-green-800/80">
        <div className="text-green-300 text-sm">
          房间: {roomId}
        </div>
        <div className="flex items-center gap-4 text-sm">
          {baseBid > 0 && (
            <span className="text-yellow-300">叫分: {baseBid}</span>
          )}
          {bombCount > 0 && (
            <span className="text-orange-300">炸弹: {bombCount}</span>
          )}
          {rocketUsed && <span className="text-red-300">火箭!</span>}
        </div>
        <div className="text-green-300 text-sm">
          {myRole === PlayerRole.Landlord
            ? "地主"
            : myRole === PlayerRole.Peasant
            ? "农民"
            : ""}
        </div>
      </div>

      {/* 上方对手区域 */}
      <div className="flex justify-between px-8 pt-4 pb-2">
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

      {/* 底牌区 */}
      {bottomCards.length > 0 && (
        <div className="flex justify-center gap-1 py-1">
          <span className="text-green-400 text-xs mr-2 self-center">
            底牌:
          </span>
          {bottomCards.map((card, index) => (
            <CardComponent
              key={`bottom-${card.rank}-${card.suit}-${index}`}
              card={card}
              small
            />
          ))}
        </div>
      )}

      {/* 中间出牌区域 */}
      <div className="flex-1 flex items-center justify-center px-8">
        {phase === GamePhase.Calling ? (
          <CallLandlord isMyTurn={isMyTurn} />
        ) : phase === GamePhase.Playing || phase === GamePhase.Ended ? (
          <PlayedCards
            lastPlay={lastPlay}
            lastPassPlayerId={lastPassPlayerId}
            playerNames={playerNames}
          />
        ) : (
          <div className="text-green-400 text-lg">等待游戏开始...</div>
        )}
      </div>

      {/* 下方自己手牌 + 操作栏 */}
      <div className="px-4 pb-4">
        {/* 当前轮次提示 */}
        {isMyTurn && phase === GamePhase.Playing && (
          <div className="text-center mb-2">
            <span className="text-yellow-400 font-bold animate-pulse">
              轮到你出牌
            </span>
          </div>
        )}

        {/* 操作栏 */}
        {phase === GamePhase.Playing && (
          <ActionBar isMyTurn={isMyTurn} canPass={canPass} />
        )}

        {/* 手牌 */}
        <div className="mt-3">
          <PlayerHand />
        </div>
      </div>

      {/* 游戏结算面板 */}
      {phase === GamePhase.Ended && gameResult && <ScoreBoard />}
    </div>
  );
}
