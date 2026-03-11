import GameBoard from "../../components/Game/GameBoard";
import type { MatchViewProps } from "../../platform/gameRegistry";

export default function DoudizhuMatchView({ roomId }: MatchViewProps) {
  return <GameBoard roomId={roomId} />;
}
