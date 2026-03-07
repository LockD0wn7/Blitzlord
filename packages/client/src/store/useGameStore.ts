import { create } from "zustand";
import type {
  Card,
  CardTrackerSnapshot,
  CardPlay,
  GameSnapshot,
  PlayerRole,
  ScoreDetail,
} from "@blitzlord/shared";
import { GamePhase, cardEquals } from "@blitzlord/shared";

interface GamePlayer {
  playerId: string;
  playerName: string;
  role: PlayerRole | null;
  cardCount: number;
  isOnline: boolean;
}

interface GameState {
  phase: GamePhase | null;
  myHand: Card[];
  myRole: PlayerRole | null;
  currentTurn: string | null;
  lastPlay: { playerId: string; play: CardPlay } | null;
  bottomCards: Card[];
  baseBid: number;
  bombCount: number;
  rocketUsed: boolean;
  players: GamePlayer[];
  callSequence: { playerId: string; bid: 0 | 1 | 2 | 3 }[];
  tracker: CardTrackerSnapshot;
  isTrackerOpen: boolean;
  selectedCards: Card[];
  hintContextKey: string | null;
  hintCursor: number;
  gameResult: {
    winnerId: string;
    winnerRole: PlayerRole;
    scores: Record<string, ScoreDetail>;
  } | null;
  errorMessage: string | null;

  // actions
  syncState: (snapshot: GameSnapshot) => void;
  setHand: (hand: Card[]) => void;
  setPhase: (phase: GamePhase) => void;
  setCurrentTurn: (turn: string | null) => void;
  setLastPlay: (play: { playerId: string; play: CardPlay } | null) => void;
  setBottomCards: (cards: Card[]) => void;
  setBaseBid: (bid: number) => void;
  setMyRole: (role: PlayerRole | null) => void;
  setBombCount: (count: number) => void;
  setRocketUsed: (used: boolean) => void;
  setPlayers: (players: GamePlayer[]) => void;
  addCallRecord: (record: { playerId: string; bid: 0 | 1 | 2 | 3 }) => void;
  syncTracker: (tracker: CardTrackerSnapshot) => void;
  appendTrackerPlay: (
    entry: CardTrackerSnapshot["history"][number],
    remainingByRank: CardTrackerSnapshot["remainingByRank"],
  ) => void;
  appendTrackerPass: (entry: CardTrackerSnapshot["history"][number]) => void;
  toggleTrackerPanel: () => void;
  toggleCardSelection: (card: Card) => void;
  clearSelection: () => void;
  applyHintSelection: (
    cards: Card[],
    contextKey: string,
    nextCursor: number,
  ) => void;
  resetHintCycle: () => void;
  removeCardsFromHand: (cards: Card[]) => void;
  setGameResult: (result: GameState["gameResult"]) => void;
  setErrorMessage: (msg: string | null) => void;
  resetGame: () => void;
  updatePlayerCardCount: (playerId: string, count: number) => void;
  setPlayerOnline: (playerId: string, online: boolean) => void;
}

const initialState = {
  phase: null as GamePhase | null,
  myHand: [] as Card[],
  myRole: null as PlayerRole | null,
  currentTurn: null as string | null,
  lastPlay: null as { playerId: string; play: CardPlay } | null,
  bottomCards: [] as Card[],
  baseBid: 0,
  bombCount: 0,
  rocketUsed: false,
  players: [] as GamePlayer[],
  callSequence: [] as { playerId: string; bid: 0 | 1 | 2 | 3 }[],
  tracker: {
    history: [],
    remainingByRank: [],
  } as CardTrackerSnapshot,
  isTrackerOpen: false,
  selectedCards: [] as Card[],
  hintContextKey: null as string | null,
  hintCursor: 0,
  gameResult: null as GameState["gameResult"],
  errorMessage: null as string | null,
};

export const useGameStore = create<GameState>((set) => ({
  ...initialState,

  syncState: (snapshot: GameSnapshot) =>
    set({
      phase: snapshot.phase,
      myHand: snapshot.myHand,
      myRole: snapshot.myRole,
      currentTurn: snapshot.currentTurn,
      lastPlay: snapshot.lastPlay,
      bottomCards: snapshot.bottomCards,
      baseBid: snapshot.baseBid,
      bombCount: snapshot.bombCount,
      rocketUsed: snapshot.rocketUsed,
      players: snapshot.players,
      callSequence: snapshot.callSequence,
      tracker: snapshot.tracker,
      selectedCards: [],
      hintContextKey: null,
      hintCursor: 0,
      gameResult: null,
      errorMessage: null,
    }),

  setHand: (hand) =>
    set({
      myHand: hand,
      hintContextKey: null,
      hintCursor: 0,
    }),
  setPhase: (phase) => set({ phase }),
  setCurrentTurn: (turn) =>
    set({
      currentTurn: turn,
      hintContextKey: null,
      hintCursor: 0,
    }),
  setLastPlay: (play) =>
    set({
      lastPlay: play,
      hintContextKey: null,
      hintCursor: 0,
    }),
  setBottomCards: (cards) => set({ bottomCards: cards }),
  setBaseBid: (bid) => set({ baseBid: bid }),
  setMyRole: (role) => set({ myRole: role }),
  setBombCount: (count) => set({ bombCount: count }),
  setRocketUsed: (used) => set({ rocketUsed: used }),
  setPlayers: (players) => set({ players }),

  addCallRecord: (record) =>
    set((state) => ({
      callSequence: [...state.callSequence, record],
    })),

  syncTracker: (tracker) => set({ tracker }),

  appendTrackerPlay: (entry, remainingByRank) =>
    set((state) => ({
      tracker: {
        history: [...state.tracker.history, entry],
        remainingByRank,
      },
    })),

  appendTrackerPass: (entry) =>
    set((state) => ({
      tracker: {
        history: [...state.tracker.history, entry],
        remainingByRank: state.tracker.remainingByRank,
      },
    })),

  toggleTrackerPanel: () =>
    set((state) => ({
      isTrackerOpen: !state.isTrackerOpen,
    })),

  toggleCardSelection: (card) =>
    set((state) => {
      const isSelected = state.selectedCards.some((c) => cardEquals(c, card));
      if (isSelected) {
        return {
          selectedCards: state.selectedCards.filter(
            (c) => !cardEquals(c, card)
          ),
        };
      }
      return { selectedCards: [...state.selectedCards, card] };
    }),

  clearSelection: () => set({ selectedCards: [] }),

  applyHintSelection: (cards, contextKey, nextCursor) =>
    set({
      selectedCards: cards,
      hintContextKey: contextKey,
      hintCursor: nextCursor,
    }),

  resetHintCycle: () =>
    set({
      hintContextKey: null,
      hintCursor: 0,
    }),

  removeCardsFromHand: (cards) =>
    set((state) => {
      const remaining = state.myHand.filter(
        (handCard) => !cards.some((c) => cardEquals(c, handCard))
      );
      return {
        myHand: remaining,
        selectedCards: [],
        hintContextKey: null,
        hintCursor: 0,
      };
    }),

  setGameResult: (result) => set({ gameResult: result }),
  setErrorMessage: (msg) => set({ errorMessage: msg }),

  resetGame: () => set({ ...initialState }),

  updatePlayerCardCount: (playerId, count) =>
    set((state) => ({
      players: state.players.map((p) =>
        p.playerId === playerId ? { ...p, cardCount: count } : p
      ),
    })),

  setPlayerOnline: (playerId, online) =>
    set((state) => ({
      players: state.players.map((p) =>
        p.playerId === playerId ? { ...p, isOnline: online } : p
      ),
    })),
}));
