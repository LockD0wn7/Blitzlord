import { useState } from "react";

interface CreateRoomSelection {
  gameId: string;
  modeId: string;
  config?: Record<string, unknown>;
}

interface CreateRoomProps {
  onCreate: (roomName: string, selection: CreateRoomSelection) => void;
}

const MODE_OPTIONS = [
  { modeId: "classic", label: "经典模式", description: "标准斗地主规则" },
  { modeId: "wildcard", label: "赖子模式", description: "随机指定点数作为赖子" },
];

export default function CreateRoom({ onCreate }: CreateRoomProps) {
  const [roomName, setRoomName] = useState("");
  const [modeId, setModeId] = useState("classic");
  const [isOpen, setIsOpen] = useState(false);

  const handleCreate = () => {
    const trimmed = roomName.trim();
    if (!trimmed) {
      return;
    }

    onCreate(trimmed, {
      gameId: "doudizhu",
      modeId,
    });

    setRoomName("");
    setModeId("classic");
    setIsOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
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
          onChange={(event) => setRoomName(event.target.value)}
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
            setModeId("classic");
          }}
          className="btn-ghost px-4 py-2.5 rounded-xl"
        >
          取消
        </button>
      </div>

      <div className="mt-4">
        <div className="mb-2 text-sm text-warm-muted">游戏模式</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {MODE_OPTIONS.map((option) => {
            const selected = option.modeId === modeId;
            return (
              <button
                key={option.modeId}
                type="button"
                onClick={() => setModeId(option.modeId)}
                className={`rounded-xl border px-4 py-3 text-left transition-all duration-200 ${
                  selected
                    ? "border-gold/60 bg-gold/10 shadow-[0_0_20px_rgba(201,165,78,0.08)]"
                    : "border-surface-border/50 bg-base-light/30 hover:border-surface-border/80"
                }`}
              >
                <div className="font-medium text-warm">{option.label}</div>
                <div className="mt-1 text-xs text-muted">{option.description}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
