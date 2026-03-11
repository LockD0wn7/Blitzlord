import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getSocket, connectSocket } from "../../socket";
import CreateRoom from "./CreateRoom";
import RoomList from "./RoomList";
import { useRoomStore } from "../../store/useRoomStore";
import { useSocketStore } from "../../store/useSocketStore";

interface RoomCreationSelection {
  gameId: string;
  modeId: string;
  config?: Record<string, unknown>;
}

export default function Lobby() {
  const navigate = useNavigate();
  const { rooms, setRooms } = useRoomStore();
  const { connected, setConnected, playerName } = useSocketStore();

  useEffect(() => {
    connectSocket();
    const socket = getSocket();

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    if (socket.connected) {
      setConnected(true);
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [setConnected]);

  useEffect(() => {
    const socket = getSocket();

    const onListUpdated = (nextRooms: Parameters<typeof setRooms>[0]) => {
      setRooms(nextRooms);
    };

    const requestRoomList = () => {
      socket.emit("room:list", (roomList) => {
        setRooms(roomList);
      });
    };

    socket.on("room:listUpdated", onListUpdated);

    if (socket.connected) {
      requestRoomList();
    }

    socket.on("connect", requestRoomList);

    return () => {
      socket.off("room:listUpdated", onListUpdated);
      socket.off("connect", requestRoomList);
    };
  }, [setRooms]);

  const handleJoin = useCallback(
    (roomId: string) => {
      const socket = getSocket();
      socket.emit(
        "room:join",
        { roomId, playerName: playerName || "玩家" },
        (response) => {
          if (response.ok) {
            navigate(`/room/${roomId}`);
            return;
          }

          alert(response.error || "加入房间失败");
        },
      );
    },
    [navigate, playerName],
  );

  const handleCreate = useCallback(
    (roomName: string, selection: RoomCreationSelection) => {
      const socket = getSocket();
      socket.emit(
        "room:create",
        {
          roomName,
          playerName: playerName || "玩家",
          gameId: selection.gameId,
          modeId: selection.modeId,
          config: selection.config,
        },
        (response) => {
          if (response.ok && response.roomId) {
            navigate(`/room/${response.roomId}`);
            return;
          }

          alert(response.error || "创建房间失败");
        },
      );
    },
    [navigate, playerName],
  );

  return (
    <div className="min-h-screen bg-base relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,_rgba(25,38,70,0.4)_0%,_transparent_60%)] pointer-events-none" />

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8 animate-fade-in">
          <div>
            <h1 className="font-cn text-2xl font-bold text-warm">游戏大厅</h1>
            <p className="text-muted text-sm mt-1">
              欢迎，<span className="text-warm-muted">{playerName || "玩家"}</span>
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <span
              className={`w-2 h-2 rounded-full transition-colors ${
                connected ? "bg-jade animate-pulse" : "bg-crimson"
              }`}
            />
            <span className="text-muted text-sm">{connected ? "已连接" : "未连接"}</span>
          </div>
        </div>

        <div className="mb-6">
          <CreateRoom onCreate={handleCreate} />
        </div>

        <div>
          <h2 className="font-cn text-lg font-semibold text-warm-muted mb-4">房间列表</h2>
          <RoomList rooms={rooms} onJoin={handleJoin} />
        </div>
      </div>
    </div>
  );
}
