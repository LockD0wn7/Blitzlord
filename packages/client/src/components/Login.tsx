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
    <div className="min-h-screen bg-green-900 flex items-center justify-center">
      <div className="bg-green-800 rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        <h1 className="text-3xl font-bold text-white text-center mb-2">
          Blitzlord
        </h1>
        <p className="text-green-300 text-center mb-8">斗地主</p>

        <div className="mb-6">
          <label
            htmlFor="playerName"
            className="block text-green-200 text-sm mb-2"
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
            className="w-full px-4 py-3 rounded-lg bg-green-700 text-white placeholder-green-400 border border-green-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
          />
        </div>

        <button
          onClick={handleEnter}
          disabled={!name.trim()}
          className="w-full py-3 rounded-lg font-bold text-lg transition-colors bg-yellow-500 text-green-900 hover:bg-yellow-400 disabled:bg-green-600 disabled:text-green-400 disabled:cursor-not-allowed"
        >
          进入大厅
        </button>
      </div>
    </div>
  );
}
