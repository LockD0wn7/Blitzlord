import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useRoomStore } from "../../store/useRoomStore";
import { useSocketStore } from "../../store/useSocketStore";
import { getSocket, connectSocket } from "../../socket";
import RoomList from "./RoomList";
import CreateRoom from "./CreateRoom";

export default function Lobby() {
  const navigate = useNavigate();
  const { rooms, setRooms } = useRoomStore();
  const { connected, setConnected, playerName } = useSocketStore();

  // 确保 socket 已连接
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

  // 监听房间列表更新
  useEffect(() => {
    const socket = getSocket();

    const onListUpdated = (rooms: Parameters<typeof setRooms>[0]) => {
      setRooms(rooms);
    };

    socket.on("room:listUpdated", onListUpdated);

    // 请求当前房间列表
    if (socket.connected) {
      socket.emit("room:list", (roomList) => {
        setRooms(roomList);
      });
    }

    // 连接成功后也请求一次
    const onConnect = () => {
      socket.emit("room:list", (roomList) => {
        setRooms(roomList);
      });
    };
    socket.on("connect", onConnect);

    return () => {
      socket.off("room:listUpdated", onListUpdated);
      socket.off("connect", onConnect);
    };
  }, [setRooms]);

  const handleJoin = useCallback(
    (roomId: string) => {
      const socket = getSocket();
      socket.emit(
        "room:join",
        { roomId, playerName: playerName || "玩家" },
        (res) => {
          if (res.ok) {
            navigate(`/room/${roomId}`);
          } else {
            alert(res.error || "加入房间失败");
          }
        }
      );
    },
    [navigate, playerName]
  );

  const handleCreate = useCallback(
    (roomName: string) => {
      const socket = getSocket();
      socket.emit(
        "room:create",
        { roomName, playerName: playerName || "玩家" },
        (res) => {
          if (res.ok && res.roomId) {
            navigate(`/room/${res.roomId}`);
          } else {
            alert(res.error || "创建房间失败");
          }
        }
      );
    },
    [navigate, playerName]
  );

  return (
    <div className="min-h-screen bg-green-900">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">游戏大厅</h1>
            <p className="text-green-400 text-sm mt-1">
              欢迎, {playerName || "玩家"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                connected ? "bg-green-400" : "bg-red-400"
              }`}
            />
            <span className="text-green-300 text-sm">
              {connected ? "已连接" : "未连接"}
            </span>
          </div>
        </div>

        {/* 创建房间 */}
        <div className="mb-6">
          <CreateRoom onCreate={handleCreate} />
        </div>

        {/* 房间列表 */}
        <div>
          <h2 className="text-lg font-semibold text-green-200 mb-4">
            房间列表
          </h2>
          <RoomList rooms={rooms} onJoin={handleJoin} />
        </div>
      </div>
    </div>
  );
}
