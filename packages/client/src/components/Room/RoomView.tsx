import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { RoomStatus, type RoomDetail } from "@blitzlord/shared";
import {
  connectSocket,
  emitAddBot,
  emitMatchReady,
  emitRemoveBot,
  emitVoteConfigChange,
  emitVoteConfigChangeVote,
  getSocket,
} from "../../socket";
import { useRoomStore } from "../../store/useRoomStore";
import { useSocketStore } from "../../store/useSocketStore";

function getModeLabel(modeId?: string, fallbackName?: string): string {
  if (modeId === "wildcard") {
    return "赖子模式";
  }
  if (modeId === "classic") {
    return "经典模式";
  }
  return fallbackName ?? "未知模式";
}

function getNextModeId(modeId: string): string {
  return modeId === "wildcard" ? "classic" : "wildcard";
}

export default function RoomView() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { currentRoom, setCurrentRoom, setConfigVote, clearConfigVote } = useRoomStore();
  const configVote = useRoomStore((state) => state.configVote);
  const { playerName } = useSocketStore();
  const token = useSocketStore((state) => state.token);
  const [voteNotice, setVoteNotice] = useState<string | null>(null);
  const hasJoinedRef = useRef(false);

  useEffect(() => {
    connectSocket();
  }, []);

  useEffect(() => {
    const socket = getSocket();
    let disposed = false;

    const onRoomUpdated = (room: RoomDetail) => {
      setCurrentRoom(room);
    };

    const onVoteConfigChangeStarted = (data: {
      initiator: string;
      gameId?: string;
      modeId?: string;
      configPatch?: Record<string, unknown>;
    }) => {
      setConfigVote(data);
    };

    const onVoteConfigChangeResult = (data: {
      passed: boolean;
      gameId?: string;
      modeId?: string;
      configPatch?: Record<string, unknown>;
    }) => {
      clearConfigVote();
      const modeLabel = getModeLabel(data.modeId);
      setVoteNotice(data.passed ? `投票通过，已切换为${modeLabel}` : "投票未通过，保持当前模式");
      window.setTimeout(() => setVoteNotice(null), 3000);
    };

    const requestRoomSync = () => {
      socket.emit("room:requestSync", (response) => {
        if (disposed) {
          return;
        }

        if (response.ok && response.room) {
          setCurrentRoom(response.room);

          if (response.room.roomId !== roomId) {
            navigate(`/room/${response.room.roomId}`, { replace: true });
            return;
          }

          if (response.room.status === RoomStatus.Playing) {
            navigate(`/game/${response.room.roomId}`, { replace: true });
          }
          return;
        }

        if (!hasJoinedRef.current && roomId) {
          hasJoinedRef.current = true;
          socket.emit(
            "room:join",
            { roomId, playerName: playerName || "玩家" },
            (joinResponse) => {
              if (disposed) {
                return;
              }

              if (joinResponse.ok) {
                requestRoomSync();
                return;
              }

              setCurrentRoom(null);
              navigate("/lobby", { replace: true });
            },
          );
          return;
        }

        if (!roomId) {
          setCurrentRoom(null);
          navigate("/lobby", { replace: true });
        }
      });
    };

    socket.on("room:updated", onRoomUpdated);
    socket.on("room:voteConfigChangeStarted", onVoteConfigChangeStarted);
    socket.on("room:voteConfigChangeResult", onVoteConfigChangeResult);

    requestRoomSync();

    return () => {
      disposed = true;
      socket.off("room:updated", onRoomUpdated);
      socket.off("room:voteConfigChangeStarted", onVoteConfigChangeStarted);
      socket.off("room:voteConfigChangeResult", onVoteConfigChangeResult);
    };
  }, [roomId, setCurrentRoom, setConfigVote, clearConfigVote, playerName, navigate]);

  useEffect(() => {
    const socket = getSocket();

    const onGameStarted = () => {
      navigate(`/game/${roomId}`);
    };

    socket.on("match:started", onGameStarted);

    return () => {
      socket.off("match:started", onGameStarted);
    };
  }, [roomId, navigate]);

  const handleReady = useCallback(() => {
    emitMatchReady();
  }, []);

  const handleLeave = useCallback(() => {
    getSocket().emit("room:leave");
    setCurrentRoom(null);
    navigate("/lobby");
  }, [navigate, setCurrentRoom]);

  const handleToggleMode = useCallback(() => {
    if (!currentRoom) {
      return;
    }

    emitVoteConfigChange(
      { modeId: getNextModeId(currentRoom.modeId) },
      (response) => {
        if (!response.ok) {
          setVoteNotice(response.error || "移除机器人失败");
          window.setTimeout(() => setVoteNotice(null), 3000);
        }
      },
    );
  }, [currentRoom]);

  const handleVote = useCallback((agree: boolean) => {
    emitVoteConfigChangeVote(agree, (response) => {
      if (!response.ok) {
        setVoteNotice(response.error || "移除机器人失败");
        window.setTimeout(() => setVoteNotice(null), 3000);
      }
    });
  }, []);

  const handleAddBot = useCallback(() => {
    emitAddBot((response) => {
      if (!response.ok) {
        setVoteNotice(response.error || "Failed to add bot");
        window.setTimeout(() => setVoteNotice(null), 3000);
      }
    });
  }, []);

  const handleRemoveBot = useCallback((playerId: string) => {
    emitRemoveBot(playerId, (response) => {
      if (!response.ok) {
        setVoteNotice(response.error || "Failed to remove bot");
        window.setTimeout(() => setVoteNotice(null), 3000);
      }
    });
  }, []);

  const myPlayerId = token || localStorage.getItem("playerId") || "";
  const me = currentRoom?.players.find((player) => player.playerId === myPlayerId);
  const isReady = me?.isReady ?? false;
  const canSwitchMode =
    currentRoom?.status === RoomStatus.Waiting ||
    currentRoom?.status === RoomStatus.Finished;
  const canManageBots = currentRoom?.status === RoomStatus.Waiting;
  const canAddBot = Boolean(canManageBots && currentRoom && currentRoom.players.length < currentRoom.maxPlayers);
  const currentModeLabel = currentRoom ? getModeLabel(currentRoom.modeId, currentRoom.modeName) : "经典模式";
  const nextModeLabel = currentRoom ? getModeLabel(getNextModeId(currentRoom.modeId)) : "赖子模式";
  const voteTargetLabel = getModeLabel(configVote?.modeId);

  return (
    <div className="min-h-screen bg-base flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,_rgba(25,38,70,0.5)_0%,_transparent_70%)] pointer-events-none" />

      <div className="relative z-10 w-full max-w-lg px-6 animate-slide-up">
        <div className="bg-surface/80 backdrop-blur-xl rounded-2xl border border-surface-border/60 shadow-[0_8px_40px_rgba(0,0,0,0.4)] p-8">
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2">
              <h1 className="font-cn text-2xl font-bold text-warm">
                {currentRoom?.roomName || "房间"}
              </h1>
              <span className="rounded bg-gold/20 px-1.5 py-0.5 text-xs font-semibold text-gold border border-gold/30">
                {currentModeLabel}
              </span>
            </div>
            <p className="text-muted text-sm mt-1">
              {currentRoom?.gameName || "斗地主"} · 房间号 {roomId}
            </p>
          </div>

          {voteNotice && (
            <div className="mb-4 text-center rounded-lg bg-gold/10 border border-gold/30 px-4 py-2 text-sm text-gold">
              {voteNotice}
            </div>
          )}

          {configVote && configVote.initiator !== myPlayerId && (
            <div className="mb-4 rounded-xl bg-surface-light/50 border border-gold/30 p-4">
              <p className="text-sm text-warm mb-3 text-center">
                有玩家发起切换为
                <span className="font-semibold text-gold mx-1">{voteTargetLabel}</span>
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

          {configVote && configVote.initiator === myPlayerId && (
            <div className="mb-4 text-center rounded-lg bg-gold/10 border border-gold/30 px-4 py-2 text-sm text-gold">
              等待其他玩家投票中...
            </div>
          )}

          <div className="space-y-3 mb-8">
            {[0, 1, 2].map((seatIndex) => {
              const player = currentRoom?.players.find((entry) => entry.seatIndex === seatIndex);
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
                    <span className="text-muted text-sm w-12">座位 {seatIndex + 1}</span>
                    {player ? (
                      <span className="flex items-center gap-2 text-warm font-medium">
                        <span>{player.playerName}</span>
                        {player.playerType === "bot" && (
                          <span className="rounded bg-gold/15 px-2 py-0.5 text-[11px] font-semibold text-gold border border-gold/25">
                            机器人
                          </span>
                        )}
                        {player.playerId === myPlayerId && (
                          <span className="text-gold text-sm">(我)</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted/50">等待加入...</span>
                    )}
                  </div>
                  {player && (
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-medium ${player.isReady ? "text-jade" : "text-muted"}`}>
                        {player.isReady ? "已准备" : "未准备"}
                      </span>
                      {canManageBots && player.playerType === "bot" && (
                        <button
                          type="button"
                          onClick={() => handleRemoveBot(player.playerId)}
                          className="rounded-lg border border-crimson/30 px-2.5 py-1 text-xs text-crimson transition-colors hover:bg-crimson/10"
                        >
                          移除
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

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

          {canAddBot && (
            <button
              onClick={handleAddBot}
              className="btn-ghost w-full mt-3 py-2.5 rounded-xl text-sm"
            >
              添加机器人
            </button>
          )}

          {canSwitchMode && !configVote && currentRoom && (
            <button
              onClick={handleToggleMode}
              className="btn-ghost w-full mt-3 py-2.5 rounded-xl text-sm"
            >
              切换为{nextModeLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
