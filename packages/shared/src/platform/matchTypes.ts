export interface MatchPlayer {
  playerId: string;
  playerName: string;
}

export interface PlayerActionEnvelope<TPayload = unknown> {
  type: string;
  payload?: TPayload;
}

export interface MatchSnapshotBase<TState = unknown> {
  gameId: string;
  modeId: string;
  state: TState;
}
