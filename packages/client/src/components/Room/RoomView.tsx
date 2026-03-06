import { useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useRoomStore } from "../../store/useRoomStore";
import { useGameStore } from "../../store/useGameStore";
import { useSocketStore } from "../../store/useSocketStore";
import { getSocket, connectSocket } from "../../socket";
import { GamePhase, sortCards } from "@blitzlord/shared";
import type { RoomDetail } from "@blitzlord/shared";

export default function RoomView() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { currentRoom, setCurrentRoom } = useRoomStore();
  const { playerName } = useSocketStore();
  const token = useSocketStore((s) => s.token);
  const {
    setHand,
    setPhase,
    setPlayers,
    setCurrentTurn,
    resetGame,
  } = useGameStore();

  // 确保连接
  useEffect(() => {
    connectSocket();
  }, []);

  // M2: 用 ref 追踪是否已发送 join，避免 currentRoom 变化导致重复注册
  const hasJoinedRef = useRef(false);

  // 监听 room:updated
  useEffect(() => {
    const socket = getSocket();

    const onRoomUpdated = (room: RoomDetail) => {
      setCurrentRoom(room);
    };

    socket.on("room:updated", onRoomUpdated);

    // 如果没有当前房间数据且有 roomId，需要通过加入来获取
    // （直接访问 URL 的情况）
    if (!hasJoinedRef.current && roomId) {
      hasJoinedRef.current = true;
      socket.emit(
        "room:join",
        { roomId, playerName: playerName || "玩家" },
        (res) => {
          if (!res.ok) {
            // 可能已经在房间里了，请求同步
            socket.emit("game:requestSync");
          }
        }
      );
    }

    return () => {
      socket.off("room:updated", onRoomUpdated);
    };
  }, [roomId, setCurrentRoom, playerName]);

  // 监听 game:started
  useEffect(() => {
    const socket = getSocket();

    const onGameStarted = (data: {
      hand: Parameters<typeof setHand>[0];
      firstCaller: string;
      players: { playerId: string; playerName: string; seatIndex: number }[];
    }) => {
      resetGame();
      setHand(sortCards(data.hand));
      setPhase(GamePhase.Calling);
      setCurrentTurn(data.firstCaller);
      setPlayers(
        data.players.map((p) => ({
          playerId: p.playerId,
          playerName: p.playerName,
          role: null,
          cardCount: 17,
          isOnline: true,
        }))
      );
      navigate(`/game/${roomId}`);
    };

    socket.on("game:started", onGameStarted);

    return () => {
      socket.off("game:started", onGameStarted);
    };
  }, [roomId, navigate, setHand, setPhase, setPlayers, setCurrentTurn, resetGame]);

  const handleReady = useCallback(() => {
    const socket = getSocket();
    socket.emit("game:ready");
  }, []);

  const handleLeave = useCallback(() => {
    const socket = getSocket();
    socket.emit("room:leave");
    setCurrentRoom(null);
    navigate("/lobby");
  }, [navigate, setCurrentRoom]);

  const myPlayerId = token || localStorage.getItem("playerId") || "";
  const me = currentRoom?.players.find((p) => p.playerId === myPlayerId);
  const isReady = me?.isReady || false;

  return (
    <div className="min-h-screen bg-base flex items-center justify-center relative overflow-hidden">
      {/* 氛围光效 */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,_rgba(25,38,70,0.5)_0%,_transparent_70%)] pointer-events-none" />

      <div className="relative z-10 w-full max-w-lg px-6 animate-slide-up">
        <div className="bg-surface/80 backdrop-blur-xl rounded-2xl border border-surface-border/60 shadow-[0_8px_40px_rgba(0,0,0,0.4)] p-8">
          {/* 房间标题 */}
          <div className="text-center mb-6">
            <h1 className="font-cn text-2xl font-bold text-warm">
              {currentRoom?.roomName || "房间"}
            </h1>
            <p className="text-muted text-sm mt-1">
              房间号: {roomId}
            </p>
          </div>

          {/* 玩家座位 */}
          <div className="space-y-3 mb-8">
            {[0, 1, 2].map((seatIndex) => {
              const player = currentRoom?.players.find(
                (p) => p.seatIndex === seatIndex
              );
              return (
                <div
                  key={seatIndex}
                  className={`flex items-center justify-between rounded-xl px-4 py-3.5 border transition-all duration-200 ${
                    player
                      ? "bg-surface-light/50 border-surface-border/50"
                      : "bg-base-light/20 border-surface-border/20 border-dashed"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-muted text-sm w-10">
                      座位{seatIndex + 1}
                    </span>
                    {player ? (
                      <span className="text-warm font-medium">
                        {player.playerName}
                        {player.playerId === myPlayerId && (
                          <span className="text-gold ml-2 text-sm">
                            (我)
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted/50">等待加入...</span>
                    )}
                  </div>
                  {player && (
                    <span
                      className={`text-sm font-medium ${
                        player.isReady ? "text-jade" : "text-muted"
                      }`}
                    >
                      {player.isReady ? "已准备" : "未准备"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-4">
            <button
              onClick={handleLeave}
              className="btn-danger flex-1 py-3 rounded-xl"
            >
              离开房间
            </button>
            <button
              onClick={handleReady}
              disabled={isReady}
              className="btn-gold flex-1 py-3 rounded-xl"
            >
              {isReady ? "已准备" : "准备"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
