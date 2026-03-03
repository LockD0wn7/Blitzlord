import { useState } from "react";

interface CreateRoomProps {
  onCreate: (roomName: string) => void;
}

export default function CreateRoom({ onCreate }: CreateRoomProps) {
  const [roomName, setRoomName] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const handleCreate = () => {
    const trimmed = roomName.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setRoomName("");
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
          }}
          className="btn-ghost px-4 py-2.5 rounded-xl"
        >
          取消
        </button>
      </div>
    </div>
  );
}
