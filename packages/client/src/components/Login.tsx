import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSocketStore } from "../store/useSocketStore";
import { connectSocket } from "../socket";

export default function Login() {
  const { playerName, setPlayerName } = useSocketStore();
  const [name, setName] = useState(playerName || "");
  const navigate = useNavigate();

  const handleEnter = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setPlayerName(trimmed);
    connectSocket();
    navigate("/lobby");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleEnter();
    }
  };

  return (
    <div className="min-h-screen bg-base flex items-center justify-center relative overflow-hidden">
      {/* 氛围光效 */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,_rgba(30,42,80,0.5)_0%,_transparent_70%)]" />

      {/* 花色水印装饰 */}
      <div className="absolute inset-0 flex items-center justify-center gap-10 opacity-[0.03] text-[140px] leading-none text-warm select-none pointer-events-none">
        <span>♠</span><span>♥</span><span>♦</span><span>♣</span>
      </div>

      <div className="relative z-10 w-full max-w-sm px-6 animate-slide-up">
        <div className="bg-surface/80 backdrop-blur-xl rounded-2xl border border-surface-border/60 shadow-[0_8px_40px_rgba(0,0,0,0.4)] p-8">
          {/* 顶部装饰线 */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/40" />
            <span className="text-gold/50 text-xs tracking-[0.3em]">♠ ♥ ♦ ♣</span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/40" />
          </div>

          <h1 className="font-display text-4xl font-bold text-gold-light text-center tracking-[0.15em] mb-1">
            BLITZLORD
          </h1>
          <p className="font-cn text-warm-muted text-center text-lg mb-8">斗地主</p>

          <div className="mb-6">
            <label
              htmlFor="playerName"
              className="block text-muted text-sm mb-2 tracking-wide"
            >
              昵称
            </label>
            <input
              id="playerName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="请输入昵称"
              maxLength={12}
              className="w-full px-4 py-3 rounded-xl bg-base-light/80 text-warm placeholder-muted/50 border border-surface-border/60 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/40 transition-all duration-200"
            />
          </div>

          <button
            onClick={handleEnter}
            disabled={!name.trim()}
            className="btn-gold w-full py-3 rounded-xl text-lg"
          >
            进入大厅
          </button>

          {/* 底部装饰线 */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/20" />
            <div className="w-1.5 h-1.5 rounded-full bg-gold/30" />
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/20" />
          </div>
        </div>
      </div>
    </div>
  );
}
