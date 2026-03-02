import type { RoomInfo } from "@blitzlord/shared";
import { RoomStatus } from "@blitzlord/shared";

interface RoomListProps {
  rooms: RoomInfo[];
  onJoin: (roomId: string) => void;
}

function statusLabel(status: RoomStatus): string {
  switch (status) {
    case RoomStatus.Waiting:
      return "等待中";
    case RoomStatus.Playing:
      return "游戏中";
    case RoomStatus.Finished:
      return "已结束";
  }
}

function statusColor(status: RoomStatus): string {
  switch (status) {
    case RoomStatus.Waiting:
      return "text-green-300";
    case RoomStatus.Playing:
      return "text-yellow-300";
    case RoomStatus.Finished:
      return "text-gray-400";
  }
}

export default function RoomList({ rooms, onJoin }: RoomListProps) {
  if (rooms.length === 0) {
    return (
      <div className="text-center text-green-400 py-12">
        暂无房间，快来创建一个吧！
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rooms.map((room) => (
        <div
          key={room.roomId}
          className="flex items-center justify-between bg-green-700/50 rounded-lg px-4 py-3 border border-green-600/50"
        >
          <div className="flex-1 min-w-0">
            <div className="text-white font-medium truncate">
              {room.roomName}
            </div>
            <div className="flex items-center gap-3 text-sm mt-1">
              <span className={statusColor(room.status)}>
                {statusLabel(room.status)}
              </span>
              <span className="text-green-400">
                {room.playerCount}/{room.maxPlayers} 人
              </span>
            </div>
          </div>
          <button
            onClick={() => onJoin(room.roomId)}
            disabled={
              room.status !== RoomStatus.Waiting ||
              room.playerCount >= room.maxPlayers
            }
            className="ml-4 px-4 py-2 rounded-lg font-medium text-sm transition-colors bg-yellow-500 text-green-900 hover:bg-yellow-400 disabled:bg-green-600 disabled:text-green-400 disabled:cursor-not-allowed"
          >
            加入
          </button>
        </div>
      ))}
    </div>
  );
}
