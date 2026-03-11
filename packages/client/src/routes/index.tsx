import { createHashRouter, Navigate } from "react-router-dom";
import Login from "../components/Login";
import Lobby from "../components/Lobby/Lobby";
import RoomView from "../components/Room/RoomView";
import GameShell from "../platform/GameShell";

/** 路由守卫：未设置昵称时重定向到登录页 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const playerName = localStorage.getItem("playerName");
  if (!playerName) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export const router = createHashRouter([
  {
    path: "/",
    element: <Login />,
  },
  {
    path: "/lobby",
    element: <RequireAuth><Lobby /></RequireAuth>,
  },
  {
    path: "/room/:roomId",
    element: <RequireAuth><RoomView /></RequireAuth>,
  },
  {
    path: "/game/:roomId",
    element: <RequireAuth><GameShell /></RequireAuth>,
  },
]);
