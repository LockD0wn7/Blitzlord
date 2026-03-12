import type { PlayerType } from "@blitzlord/shared";

export interface MatchPlayer {
  playerId: string;
  playerName: string;
  playerType: PlayerType;
}
