import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { RoomStatus } from "@blitzlord/shared";
import { connectSocket, getSocket } from "../socket";
import { useRoomStore } from "../store/useRoomStore";
import {
  clientGameRegistry,
  type ClientGameRegistryLike,
} from "./gameRegistry";

interface GameShellViewProps {
  roomId: string;
  gameId: string;
  registry?: ClientGameRegistryLike;
}

export function resolveGameShellRedirect(params: {
  requestedRoomId: string;
  syncedRoom:
    | {
        roomId: string;
        status: RoomStatus;
      }
    | null;
}): string | null {
  const { requestedRoomId, syncedRoom } = params;

  if (!syncedRoom) {
    return "/lobby";
  }

  if (syncedRoom.status !== RoomStatus.Playing) {
    return `/room/${syncedRoom.roomId}`;
  }

  if (syncedRoom.roomId !== requestedRoomId) {
    return `/game/${syncedRoom.roomId}`;
  }

  return null;
}

export function GameShellView({
  roomId,
  gameId,
  registry = clientGameRegistry,
}: GameShellViewProps) {
  const registeredGame = registry.getGame(gameId);

  if (!registeredGame) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base text-warm">
        Unsupported game: {gameId}
      </div>
    );
  }

  const MatchView = registeredGame.MatchView;
  return <MatchView roomId={roomId} />;
}

export default function GameShell() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const currentRoom = useRoomStore((state) => state.currentRoom);
  const setCurrentRoom = useRoomStore((state) => state.setCurrentRoom);

  useEffect(() => {
    connectSocket();
  }, []);

  useEffect(() => {
    if (!roomId) {
      return;
    }

    if (currentRoom?.roomId === roomId) {
      if (currentRoom.status !== RoomStatus.Playing) {
        navigate(`/room/${roomId}`, { replace: true });
      }
      return;
    }

    const socket = getSocket();
    socket.emit("room:requestSync", (result) => {
      if (!result.ok || !result.room) {
        navigate("/lobby", { replace: true });
        return;
      }

      setCurrentRoom(result.room);
      const redirectPath = resolveGameShellRedirect({
        requestedRoomId: roomId,
        syncedRoom: result.room,
      });
      if (redirectPath) {
        navigate(redirectPath, { replace: true });
      }
    });
  }, [currentRoom, navigate, roomId, setCurrentRoom]);

  if (!roomId) {
    return null;
  }

  if (!currentRoom || currentRoom.roomId !== roomId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base text-warm">
        Loading match...
      </div>
    );
  }

  return <GameShellView roomId={roomId} gameId={currentRoom.gameId} />;
}
