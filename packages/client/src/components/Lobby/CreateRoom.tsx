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
        className="w-full py-3 rounded-lg font-bold text-lg transition-colors bg-yellow-500 text-green-900 hover:bg-yellow-400"
      >
        创建房间
      </button>
    );
  }

  return (
    <div className="bg-green-700/50 rounded-lg p-4 border border-green-600/50">
      <div className="flex gap-3">
        <input
          type="text"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入房间名称"
          maxLength={20}
          autoFocus
          className="flex-1 px-4 py-2 rounded-lg bg-green-700 text-white placeholder-green-400 border border-green-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
        />
        <button
          onClick={handleCreate}
          disabled={!roomName.trim()}
          className="px-5 py-2 rounded-lg font-medium transition-colors bg-yellow-500 text-green-900 hover:bg-yellow-400 disabled:bg-green-600 disabled:text-green-400 disabled:cursor-not-allowed"
        >
          创建
        </button>
        <button
          onClick={() => {
            setIsOpen(false);
            setRoomName("");
          }}
          className="px-4 py-2 rounded-lg font-medium transition-colors bg-green-600 text-green-200 hover:bg-green-500"
        >
          取消
        </button>
      </div>
    </div>
  );
}
