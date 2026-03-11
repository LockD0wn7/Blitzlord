import { RoomStatus, type RoomInfo } from "@blitzlord/shared";

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
      return "text-jade";
    case RoomStatus.Playing:
      return "text-gold";
    case RoomStatus.Finished:
      return "text-muted";
  }
}

function getModeLabel(room: RoomInfo): string {
  if (room.modeId === "wildcard") {
    return "赖子模式";
  }
  if (room.modeId === "classic") {
    return "经典模式";
  }
  return room.modeName;
}

export default function RoomList({ rooms, onJoin }: RoomListProps) {
  if (rooms.length === 0) {
    return (
      <div className="text-center text-muted py-16">
        <div className="text-4xl mb-3 opacity-30">+</div>
        暂无房间，创建一个开始吧。
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rooms.map((room) => (
        <div
          key={room.roomId}
          className="flex items-center justify-between bg-surface/50 backdrop-blur-sm rounded-xl px-5 py-4 border border-surface-border/40 hover:border-surface-border/70 hover:bg-surface/70 transition-all duration-200"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-warm font-medium truncate">
              <span className="truncate">{room.roomName}</span>
              <span className="shrink-0 rounded bg-gold/20 px-1.5 py-0.5 text-xs font-semibold text-gold border border-gold/30">
                {getModeLabel(room)}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-3 text-sm">
              <span className="text-muted">{room.gameName}</span>
              <span className={statusColor(room.status)}>{statusLabel(room.status)}</span>
              <span className="text-muted">
                {room.playerCount}/{room.maxPlayers} 人
              </span>
            </div>
          </div>
          <button
            onClick={() => onJoin(room.roomId)}
            disabled={room.status !== RoomStatus.Waiting || room.playerCount >= room.maxPlayers}
            className="btn-gold ml-4 px-4 py-2 rounded-lg text-sm"
          >
            加入
          </button>
        </div>
      ))}
    </div>
  );
}
