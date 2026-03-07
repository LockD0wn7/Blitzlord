import { useState } from "react";

interface CreateRoomProps {
  onCreate: (roomName: string, wildcard?: boolean) => void;
}

export default function CreateRoom({ onCreate }: CreateRoomProps) {
  const [roomName, setRoomName] = useState("");
  const [wildcard, setWildcard] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleCreate = () => {
    const trimmed = roomName.trim();
    if (!trimmed) return;
    onCreate(trimmed, wildcard);
    setRoomName("");
    setWildcard(false);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCreate();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="btn-gold w-full py-3 rounded-xl text-lg"
      >
        创建房间
      </button>
    );
  }

  return (
    <div className="bg-surface/60 backdrop-blur-md rounded-xl p-4 border border-surface-border/50">
      <div className="flex gap-3">
        <input
          type="text"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入房间名称"
          maxLength={20}
          autoFocus
          className="flex-1 px-4 py-2.5 rounded-xl bg-base-light/80 text-warm placeholder-muted/50 border border-surface-border/60 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/40 transition-all duration-200"
        />
        <button
          onClick={handleCreate}
          disabled={!roomName.trim()}
          className="btn-gold px-5 py-2.5 rounded-xl"
        >
          创建
        </button>
        <button
          onClick={() => {
            setIsOpen(false);
            setRoomName("");
            setWildcard(false);
          }}
          className="btn-ghost px-4 py-2.5 rounded-xl"
        >
          取消
        </button>
      </div>
      <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={wildcard}
          onChange={(e) => setWildcard(e.target.checked)}
          className="w-4 h-4 rounded border-surface-border/60 accent-gold"
        />
        <span className="text-sm text-warm-muted">赖子模式</span>
        {wildcard && (
          <span className="text-xs text-gold ml-1">随机指定一个点数为万能牌</span>
        )}
      </label>
    </div>
  );
}
