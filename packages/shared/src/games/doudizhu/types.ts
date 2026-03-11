import type { Card, CardPlay, Rank } from "../../types/card.js";
import type { GameSnapshot, GameState } from "../../types/game.js";

export type DoudizhuCard = Card;
export type DoudizhuPlay = CardPlay;

export interface DoudizhuModeConfig {
  wildcard: boolean;
}

export interface DoudizhuPlayMeta {
  softBomb?: boolean;
  pureWild?: boolean;
}

export interface DoudizhuState extends GameState {
  wildcardRank: Rank | null;
}

export interface DoudizhuSnapshot extends GameSnapshot {
  wildcardRank: Rank | null;
}

export function isDoudizhuSnapshot(snapshot: GameSnapshot): snapshot is DoudizhuSnapshot {
  return snapshot.gameId === "doudizhu" && "wildcardRank" in snapshot;
}
