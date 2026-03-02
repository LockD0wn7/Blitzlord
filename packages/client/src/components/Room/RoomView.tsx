import { useEffect, useCallback } from "react";
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

  // 监听 room:updated
  useEffect(() => {
    const socket = getSocket();

    const onRoomUpdated = (room: RoomDetail) => {
      setCurrentRoom(room);
    };

    socket.on("room:updated", onRoomUpdated);

    // 如果没有当前房间数据且有 roomId，需要通过加入来获取
    // （直接访问 URL 的情况）
    if (!currentRoom && roomId) {
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
  }, [roomId, currentRoom, setCurrentRoom, playerName]);

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
    <div className="min-h-screen bg-green-900 flex items-center justify-center">
      <div className="bg-green-800 rounded-2xl shadow-2xl p-8 w-full max-w-lg">
        {/* 房间标题 */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white">
            {currentRoom?.roomName || "房间"}
          </h1>
          <p className="text-green-400 text-sm mt-1">
            房间号: {roomId}
          </p>
        </div>

        {/* 玩家列表 */}
        <div className="space-y-3 mb-8">
          {[0, 1, 2].map((seatIndex) => {
            const player = currentRoom?.players.find(
              (p) => p.seatIndex === seatIndex
            );
            return (
              <div
                key={seatIndex}
                className={`flex items-center justify-between rounded-lg px-4 py-3 border ${
                  player
                    ? "bg-green-700/50 border-green-600/50"
                    : "bg-green-700/20 border-green-700/30 border-dashed"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-green-400 text-sm w-8">
                    座位{seatIndex + 1}
                  </span>
                  {player ? (
                    <span className="text-white font-medium">
                      {player.playerName}
                      {player.playerId === myPlayerId && (
                        <span className="text-yellow-400 ml-2 text-sm">
                          (我)
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-green-500">等待加入...</span>
                  )}
                </div>
                {player && (
                  <span
                    className={`text-sm font-medium ${
                      player.isReady ? "text-green-300" : "text-gray-400"
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
            className="flex-1 py-3 rounded-lg font-medium transition-colors bg-red-600/80 text-white hover:bg-red-500"
          >
            离开房间
          </button>
          <button
            onClick={handleReady}
            disabled={isReady}
            className={`flex-1 py-3 rounded-lg font-bold transition-colors ${
              isReady
                ? "bg-green-600 text-green-300 cursor-not-allowed"
                : "bg-yellow-500 text-green-900 hover:bg-yellow-400"
            }`}
          >
            {isReady ? "已准备" : "准备"}
          </button>
        </div>
      </div>
    </div>
  );
}
