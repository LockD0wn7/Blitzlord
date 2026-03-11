import type { Card, CardPlay, Rank } from "./card.js";

export enum GamePhase {
  Dealing = "dealing",
  Calling = "calling",
  Playing = "playing",
  Ended = "ended",
}

export enum PlayerRole {
  Landlord = "landlord",
  Peasant = "peasant",
}

export interface PlayerState {
  playerId: string;
  playerName: string;
  hand: Card[];
  role: PlayerRole | null;
  isOnline: boolean;
  playCount: number; // 出牌次数，用于春天判定
}

export interface GameState {
  roomId: string;
  gameId: string;
  modeId: string;
  phase: GamePhase;
  players: PlayerState[];
  currentTurn: string | null; // 当前出牌的 playerId
  lastPlay: { playerId: string; play: CardPlay } | null;
  consecutivePasses: number;
  bottomCards: Card[];
  baseBid: 0 | 1 | 2 | 3;
  bombCount: number;
  rocketUsed: boolean;
  callSequence: { playerId: string; bid: 0 | 1 | 2 | 3 }[];
  redealCount: number;
}

export interface ScoreDetail {
  baseBid: 0 | 1 | 2 | 3;
  bombCount: number;
  rocketUsed: boolean;
  isSpring: boolean;
  finalScore: number;
}

export interface TrackerHistoryEntry {
  sequence: number;
  round: number;
  playerId: string;
  action: "play" | "pass";
  cards: Card[];
}

export interface TrackerRankStat {
  rank: Rank;
  totalCopies: number;
  playedCopies: number;
  myCopies: number;
  remainingOpponentCopies: number;
}

export interface CardTrackerSnapshot {
  history: TrackerHistoryEntry[];
  remainingByRank: TrackerRankStat[];
}

/** 玩家视角的完整状态快照，用于 syncState 重连推送 */
export interface GameSnapshot {
  roomId: string;
  gameId: string;
  modeId: string;
  phase: GamePhase;
  myHand: Card[];
  myRole: PlayerRole | null;
  currentTurn: string | null;
  lastPlay: { playerId: string; play: CardPlay } | null;
  consecutivePasses: number;
  bottomCards: Card[]; // 叫地主确定后才有值
  baseBid: 0 | 1 | 2 | 3;
  bombCount: number;
  rocketUsed: boolean;
  players: {
    playerId: string;
    playerName: string;
    role: PlayerRole | null;
    cardCount: number; // 他人只能看到牌数
    isOnline: boolean;
  }[];
  callSequence: { playerId: string; bid: 0 | 1 | 2 | 3 }[];
  tracker: CardTrackerSnapshot;
}
