import { useEffect, useCallback, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useRoomStore } from "../../store/useRoomStore";
import { useGameStore } from "../../store/useGameStore";
import { useSocketStore } from "../../store/useSocketStore";
import { getSocket, connectSocket, emitVoteMode, emitVoteModeVote } from "../../socket";
import { GamePhase, RoomStatus, sortCards } from "@blitzlord/shared";
import type { RoomDetail } from "@blitzlord/shared";

export default function RoomView() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { currentRoom, setCurrentRoom, setModeVote, clearModeVote } = useRoomStore();
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
    let disposed = false;

    const onRoomUpdated = (room: RoomDetail) => {
      setCurrentRoom(room);
    };

    const onVoteModeStarted = (data: { initiator: string; wildcard: boolean }) => {
      setModeVote(data);
    };

    const onVoteModeResult = (data: { passed: boolean; wildcard: boolean }) => {
      clearModeVote();
      const modeLabel = data.wildcard ? "赖子模式" : "普通模式";
      if (data.passed) {
        setVoteNotice(`投票通过，已切换为${modeLabel}`);
      } else {
        setVoteNotice(`投票未通过，保持当前模式`);
      }
      setTimeout(() => setVoteNotice(null), 3000);
    };

    socket.on("room:updated", onRoomUpdated);
    socket.on("room:voteModeStarted", onVoteModeStarted);
    socket.on("room:voteModeResult", onVoteModeResult);

    const requestRoomSync = () => {
      socket.emit("room:requestSync", (res) => {
        if (disposed) return;

        if (res.ok && res.room) {
          setCurrentRoom(res.room);

          if (res.room.roomId !== roomId) {
            navigate(`/room/${res.room.roomId}`, { replace: true });
            return;
          }

          if (res.room.status === RoomStatus.Playing) {
            navigate(`/game/${res.room.roomId}`, { replace: true });
          }
          return;
        }

        if (!hasJoinedRef.current && roomId) {
          hasJoinedRef.current = true;
          socket.emit(
            "room:join",
            { roomId, playerName: playerName || "玩家" },
            (joinRes) => {
              if (disposed) return;

              if (joinRes.ok) {
                requestRoomSync();
                return;
              }

              setCurrentRoom(null);
              navigate("/lobby", { replace: true });
            }
          );
        } else if (!roomId) {
          setCurrentRoom(null);
          navigate("/lobby", { replace: true });
        }
      });
    };

    requestRoomSync();

    return () => {
      disposed = true;
      socket.off("room:updated", onRoomUpdated);
      socket.off("room:voteModeStarted", onVoteModeStarted);
      socket.off("room:voteModeResult", onVoteModeResult);
    };
  }, [roomId, setCurrentRoom, setModeVote, clearModeVote, playerName, navigate]);

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

  const modeVote = useRoomStore((s) => s.modeVote);
  const [voteNotice, setVoteNotice] = useState<string | null>(null);

  const myPlayerId = token || localStorage.getItem("playerId") || "";
  const me = currentRoom?.players.find((p) => p.playerId === myPlayerId);
  const isReady = me?.isReady || false;
  const canSwitchMode =
    currentRoom?.status === RoomStatus.Waiting ||
    currentRoom?.status === RoomStatus.Finished;

  const handleToggleMode = useCallback(() => {
    if (!currentRoom) return;
    const newWildcard = !currentRoom.wildcard;
    emitVoteMode(newWildcard, (res) => {
      if (!res.ok) {
        setVoteNotice(res.error || "发起投票失败");
        setTimeout(() => setVoteNotice(null), 3000);
      }
    });
  }, [currentRoom]);

  const handleVote = useCallback((agree: boolean) => {
    emitVoteModeVote(agree, (res) => {
      if (!res.ok) {
        setVoteNotice(res.error || "投票失败");
        setTimeout(() => setVoteNotice(null), 3000);
      }
    });
  }, []);

  return (
    <div className="min-h-screen bg-base flex items-center justify-center relative overflow-hidden">
      {/* 氛围光效 */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,_rgba(25,38,70,0.5)_0%,_transparent_70%)] pointer-events-none" />

      <div className="relative z-10 w-full max-w-lg px-6 animate-slide-up">
        <div className="bg-surface/80 backdrop-blur-xl rounded-2xl border border-surface-border/60 shadow-[0_8px_40px_rgba(0,0,0,0.4)] p-8">
          {/* 房间标题 */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2">
              <h1 className="font-cn text-2xl font-bold text-warm">
                {currentRoom?.roomName || "房间"}
              </h1>
              {currentRoom?.wildcard && (
                <span className="rounded bg-gold/20 px-1.5 py-0.5 text-xs font-semibold text-gold border border-gold/30">
                  赖子
                </span>
              )}
            </div>
            <p className="text-muted text-sm mt-1">
              房间号: {roomId}
            </p>
          </div>

          {/* 投票通知 */}
          {voteNotice && (
            <div className="mb-4 text-center rounded-lg bg-gold/10 border border-gold/30 px-4 py-2 text-sm text-gold">
              {voteNotice}
            </div>
          )}

          {/* 模式投票面板 */}
          {modeVote && modeVote.initiator !== myPlayerId && (
            <div className="mb-4 rounded-xl bg-surface-light/50 border border-gold/30 p-4">
              <p className="text-sm text-warm mb-3 text-center">
                有玩家发起切换为
                <span className="font-semibold text-gold mx-1">
                  {modeVote.wildcard ? "赖子模式" : "普通模式"}
                </span>
                的投票
              </p>
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => handleVote(true)}
                  className="btn-gold px-6 py-2 rounded-lg text-sm"
                >
                  同意
                </button>
                <button
                  onClick={() => handleVote(false)}
                  className="btn-danger px-6 py-2 rounded-lg text-sm"
                >
                  拒绝
                </button>
              </div>
            </div>
          )}

          {/* 投票发起者等待提示 */}
          {modeVote && modeVote.initiator === myPlayerId && (
            <div className="mb-4 text-center rounded-lg bg-gold/10 border border-gold/30 px-4 py-2 text-sm text-gold">
              等待其他玩家投票中...
            </div>
          )}

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

          {/* 切换模式按钮 */}
          {canSwitchMode && !modeVote && (
            <button
              onClick={handleToggleMode}
              className="btn-ghost w-full mt-3 py-2.5 rounded-xl text-sm"
            >
              切换为{currentRoom?.wildcard ? "普通模式" : "赖子模式"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
