import {
  type Card,
  type CardPlay,
  CardType,
  GamePhase,
  PlayerRole,
  type PlayerState,
  Rank,
  type ScoreDetail,
  type TrackerHistoryEntry,
  buildCardTrackerSnapshot,
  createDeck,
  shuffleDeck,
  dealCards,
  sortCards,
  cardEquals,
  MAX_REDEAL_COUNT,
} from "@blitzlord/shared";
import {
  type DoudizhuSnapshot,
  type DoudizhuState,
  validatePlay,
  calculateScore,
  isSpring,
} from "@blitzlord/shared/games/doudizhu";
import type { MatchPlayer } from "../../platform/types.js";
import {
  normalizeRoomGameSelection,
  type RoomGameSelection,
} from "../../room/Room.js";

export interface GameEndResult {
  winnerId: string;
  winnerRole: PlayerRole;
  scores: Record<string, ScoreDetail>;
}

export class DoudizhuMatchRuntime {
  private state: DoudizhuState;
  private trackerHistory: TrackerHistoryEntry[] = [];
  private trackerSequence = 0;
  private trackerRound = 1;
  private readonly wildcard: boolean;

  /** 叫分轮转顺序中，当前应该叫分的玩家索引 */
  private callerIndex: number;
  /** 叫分起始玩家索引 */
  private firstCallerIndex: number;

  constructor(roomId: string, players: MatchPlayer[], selection: RoomGameSelection) {
    if (players.length !== 3) {
      throw new Error("斗地主必须 3 个玩家");
    }
    const normalizedSelection = normalizeRoomGameSelection(selection);
    this.wildcard = normalizedSelection.modeId === "wildcard" || Boolean(normalizedSelection.config.wildcard);
    this.state = {
      roomId,
      gameId: normalizedSelection.gameId,
      modeId: normalizedSelection.modeId,
      phase: GamePhase.Dealing,
      players: players.map((p) => ({
        playerId: p.playerId,
        playerName: p.playerName,
        playerType: p.playerType,
        hand: [],
        role: null,
        isOnline: true,
        playCount: 0,
      })),
      currentTurn: null,
      lastPlay: null,
      consecutivePasses: 0,
      bottomCards: [],
      baseBid: 0,
      bombCount: 0,
      rocketUsed: false,
      callSequence: [],
      redealCount: 0,
      wildcardRank: null,
    };

    // 随机选择首个叫分者
    this.firstCallerIndex = Math.floor(Math.random() * 3);
    this.callerIndex = this.firstCallerIndex;

    this.deal();
  }

  get phase(): GamePhase {
    return this.state.phase;
  }

  get roomId(): string {
    return this.state.roomId;
  }

  get gameId(): string {
    return this.state.gameId;
  }

  get modeId(): string {
    return this.state.modeId;
  }

  /** 获取当前应该叫分的玩家 ID */
  get currentCallerId(): string | null {
    if (this.state.phase !== GamePhase.Calling) return null;
    return this.state.players[this.callerIndex].playerId;
  }

  /** 获取当前轮到出牌的玩家 ID */
  get currentTurn(): string | null {
    return this.state.currentTurn;
  }

  /** 获取底牌 */
  get bottomCards(): Card[] {
    return this.state.bottomCards;
  }

  /** 获取叫分序列 */
  get callSequence() {
    return this.state.callSequence;
  }

  /** 获取上一手牌 */
  get lastPlay() {
    return this.state.lastPlay;
  }

  /** 查找玩家状态（内部使用，统一处理查找） */
  private getPlayerState(playerId: string): PlayerState | undefined {
    return this.state.players.find((p) => p.playerId === playerId);
  }

  /** 获取玩家手牌 */
  getPlayerHand(playerId: string): Card[] {
    return this.getPlayerState(playerId)?.hand ?? [];
  }

  /** 获取玩家剩余牌数 */
  getPlayerCardCount(playerId: string): number {
    return this.getPlayerState(playerId)?.hand.length ?? 0;
  }

  private resetTracker(): void {
    this.trackerHistory = [];
    this.trackerSequence = 0;
    this.trackerRound = 1;
  }

  private pushTrackerEntry(
    playerId: string,
    action: TrackerHistoryEntry["action"],
    cards: Card[],
  ): void {
    this.trackerSequence += 1;
    this.trackerHistory.push({
      sequence: this.trackerSequence,
      round: this.trackerRound,
      playerId,
      action,
      cards: cards.map((card) => ({ ...card })),
    });
  }

  // ===================== 发牌阶段 =====================

  private deal(): void {
    const deck = shuffleDeck(createDeck());
    const [h1, h2, h3, bottom] = dealCards(deck);
    const hands = [h1, h2, h3];

    for (let i = 0; i < 3; i++) {
      this.state.players[i].hand = sortCards(hands[i]);
      this.state.players[i].role = null;
      this.state.players[i].playCount = 0;
    }

    this.state.bottomCards = bottom;
    this.state.lastPlay = null;
    this.state.consecutivePasses = 0;
    this.state.currentTurn = null;
    this.state.bombCount = 0;
    this.state.rocketUsed = false;
    this.state.callSequence = [];
    this.resetTracker();

    this.state.phase = GamePhase.Calling;
  }

  // ===================== 叫分阶段 =====================

  /**
   * 玩家叫分。
   * @returns 叫分结果。landlord 为 null 表示本轮叫分未结束（或需重发牌）。
   */
  callBid(
    playerId: string,
    bid: 0 | 1 | 2 | 3,
  ): {
    ok: boolean;
    error?: string;
    nextCaller?: string | null;
    landlord?: { playerId: string; bottomCards: Card[]; baseBid: 1 | 2 | 3; wildcardRank: Rank | null } | null;
    redeal?: boolean;
  } {
    if (this.state.phase !== GamePhase.Calling) {
      return { ok: false, error: "当前不在叫分阶段" };
    }

    if (this.state.players[this.callerIndex].playerId !== playerId) {
      return { ok: false, error: "不是你的叫分轮次" };
    }

    // 验证叫分值
    if (bid !== 0) {
      const currentMax = this.getCurrentMaxBid();
      if (bid <= currentMax) {
        return { ok: false, error: `叫分必须大于当前最高分 ${currentMax}` };
      }
    }

    this.state.callSequence.push({ playerId, bid });

    // 叫 3 分，封顶，直接成为地主
    if (bid === 3) {
      return { ok: true, nextCaller: null, ...this.decideLandlord(playerId, 3) };
    }

    // 检查是否所有人都已叫过
    if (this.state.callSequence.length >= 3) {
      return this.finishCallingRound();
    }

    // 移动到下一个叫分者
    this.callerIndex = (this.callerIndex + 1) % 3;
    return { ok: true, nextCaller: this.state.players[this.callerIndex].playerId, landlord: null };
  }

  private getCurrentMaxBid(): number {
    let max = 0;
    for (const c of this.state.callSequence) {
      if (c.bid > max) max = c.bid;
    }
    return max;
  }

  private finishCallingRound(): {
    ok: boolean;
    nextCaller?: string | null;
    landlord?: { playerId: string; bottomCards: Card[]; baseBid: 1 | 2 | 3; wildcardRank: Rank | null } | null;
    redeal?: boolean;
  } {
    const maxBid = this.getCurrentMaxBid();

    if (maxBid === 0) {
      // 全部不叫
      this.state.redealCount++;
      if (this.state.redealCount >= MAX_REDEAL_COUNT) {
        // 超过重发上限，强制随机指定
        const forcedIndex = Math.floor(Math.random() * 3);
        const forcedPlayer = this.state.players[forcedIndex].playerId;
        return { ok: true, nextCaller: null, ...this.decideLandlord(forcedPlayer, 1) };
      }

      // 重新发牌
      this.firstCallerIndex = (this.firstCallerIndex + 1) % 3;
      this.callerIndex = this.firstCallerIndex;
      this.deal();
      return {
        ok: true,
        nextCaller: this.state.players[this.callerIndex].playerId,
        landlord: null,
        redeal: true,
      };
    }

    // 找到叫分最高的玩家
    let highestBidder = this.state.callSequence[0];
    for (const c of this.state.callSequence) {
      if (c.bid > highestBidder.bid) highestBidder = c;
    }

    return {
      ok: true,
      nextCaller: null,
      ...this.decideLandlord(highestBidder.playerId, maxBid as 1 | 2 | 3),
    };
  }

  private decideLandlord(
    landlordId: string,
    baseBid: 1 | 2 | 3,
  ): { landlord: { playerId: string; bottomCards: Card[]; baseBid: 1 | 2 | 3; wildcardRank: Rank | null } } {
    this.state.baseBid = baseBid;

    for (const p of this.state.players) {
      p.role = p.playerId === landlordId ? PlayerRole.Landlord : PlayerRole.Peasant;
    }

    // 赖子模式：随机选择赖子 rank
    if (this.wildcard) {
      const normalRanks = [
        Rank.Three, Rank.Four, Rank.Five, Rank.Six, Rank.Seven,
        Rank.Eight, Rank.Nine, Rank.Ten, Rank.Jack, Rank.Queen,
        Rank.King, Rank.Ace, Rank.Two,
      ];
      this.state.wildcardRank = normalRanks[Math.floor(Math.random() * normalRanks.length)];
    }

    // 地主拿底牌
    const landlord = this.state.players.find((p) => p.playerId === landlordId)!;
    landlord.hand = sortCards([...landlord.hand, ...this.state.bottomCards]);

    // 进入出牌阶段，地主先出
    this.state.phase = GamePhase.Playing;
    this.state.currentTurn = landlordId;

    return {
      landlord: {
        playerId: landlordId,
        bottomCards: [...this.state.bottomCards],
        baseBid,
        wildcardRank: this.state.wildcardRank,
      },
    };
  }

  // ===================== 出牌阶段 =====================

  /**
   * 出牌
   * @returns 出牌结果。gameEnd 不为 null 表示游戏结束。
   */
  playCards(
    playerId: string,
    cards: Card[],
  ): {
    ok: boolean;
    error?: string;
    play?: CardPlay;
    remainingCards?: number;
    gameEnd?: GameEndResult | null;
  } {
    if (this.state.phase !== GamePhase.Playing) {
      return { ok: false, error: "当前不在出牌阶段" };
    }
    if (this.state.currentTurn !== playerId) {
      return { ok: false, error: "不是你的出牌轮次" };
    }

    const playerState = this.getPlayerState(playerId)!;
    const previousPlay = this.state.lastPlay?.play ?? null;

    const result = validatePlay(cards, playerState.hand, previousPlay, this.state.wildcardRank);
    if (!result.valid || !result.play) {
      return { ok: false, error: result.error ?? "无效出牌" };
    }

    const play = result.play;

    // 从手牌中移除打出的牌
    for (const card of cards) {
      const idx = playerState.hand.findIndex((h) => cardEquals(h, card));
      if (idx !== -1) playerState.hand.splice(idx, 1);
    }

    playerState.playCount++;
    this.pushTrackerEntry(playerId, "play", play.cards);

    // 记录炸弹/火箭
    if (play.type === CardType.Bomb) {
      this.state.bombCount++;
    } else if (play.type === CardType.Rocket) {
      this.state.rocketUsed = true;
    }

    this.state.lastPlay = { playerId, play };
    this.state.consecutivePasses = 0;

    // 检查是否出完（游戏结束）
    if (playerState.hand.length === 0) {
      return {
        ok: true,
        play,
        remainingCards: 0,
        gameEnd: this.endGame(playerId),
      };
    }

    // 轮到下一个人
    this.advanceTurn();

    return {
      ok: true,
      play,
      remainingCards: playerState.hand.length,
      gameEnd: null,
    };
  }

  /**
   * 不出（pass）
   */
  pass(playerId: string): {
    ok: boolean;
    error?: string;
    nextTurn?: string;
    resetRound?: boolean;
  } {
    if (this.state.phase !== GamePhase.Playing) {
      return { ok: false, error: "当前不在出牌阶段" };
    }
    if (this.state.currentTurn !== playerId) {
      return { ok: false, error: "不是你的出牌轮次" };
    }

    // 自由出牌时不能 pass（你是当前最大的或你是第一个出牌的）
    if (!this.state.lastPlay || this.state.lastPlay.playerId === playerId) {
      return { ok: false, error: "你是当前控牌者，必须出牌" };
    }

    this.state.consecutivePasses++;
    this.pushTrackerEntry(playerId, "pass", []);

    // 连续 2 个人 pass，控牌权回到上一个出牌者
    if (this.state.consecutivePasses >= 2) {
      this.state.currentTurn = this.state.lastPlay.playerId;
      this.state.lastPlay = null;
      this.state.consecutivePasses = 0;
      this.trackerRound += 1;
      return { ok: true, nextTurn: this.state.currentTurn, resetRound: true };
    }

    this.advanceTurn();
    return { ok: true, nextTurn: this.state.currentTurn!, resetRound: false };
  }

  private advanceTurn(): void {
    const idx = this.state.players.findIndex((p) => p.playerId === this.state.currentTurn);
    this.state.currentTurn = this.state.players[(idx + 1) % 3].playerId;
  }

  // ===================== 游戏结束 =====================

  private endGame(winnerId: string): GameEndResult {
    this.state.phase = GamePhase.Ended;

    const winner = this.getPlayerState(winnerId)!;
    const winnerRole = winner.role!;

    const landlord = this.state.players.find((p) => p.role === PlayerRole.Landlord)!;
    const peasants = this.state.players.filter((p) => p.role === PlayerRole.Peasant);

    // 只有实际发生了出牌才检测春天（避免断线超时时所有 playCount=0 的误判）
    const anyPlayed = landlord.playCount > 0 || peasants[0].playCount > 0 || peasants[1].playCount > 0;
    const springDetected = anyPlayed && isSpring(
      landlord.playCount,
      [peasants[0].playCount, peasants[1].playCount],
      winnerRole,
    );

    const scoringBaseBid = this.state.baseBid === 0 ? 1 : this.state.baseBid;
    const finalScore = calculateScore({
      baseBid: scoringBaseBid,
      bombCount: this.state.bombCount,
      rocketUsed: this.state.rocketUsed,
      isSpring: springDetected,
    });

    const scoreDetail: ScoreDetail = {
      baseBid: scoringBaseBid,
      bombCount: this.state.bombCount,
      rocketUsed: this.state.rocketUsed,
      isSpring: springDetected,
      finalScore,
    };

    const scores: Record<string, ScoreDetail> = {};
    const landlordWins = winnerRole === PlayerRole.Landlord;

    for (const p of this.state.players) {
      if (p.role === PlayerRole.Landlord) {
        scores[p.playerId] = {
          ...scoreDetail,
          finalScore: landlordWins ? finalScore * 2 : -(finalScore * 2),
        };
      } else {
        scores[p.playerId] = {
          ...scoreDetail,
          finalScore: landlordWins ? -finalScore : finalScore,
        };
      }
    }

    return { winnerId, winnerRole, scores };
  }

  // ===================== 断线处理 =====================

  /** 标记玩家在线状态 */
  setPlayerOnline(playerId: string, online: boolean): void {
    const ps = this.getPlayerState(playerId);
    if (ps) ps.isOnline = online;
  }

  /** 断线超时判负 */
  handleDisconnectTimeout(playerId: string): GameEndResult | null {
    if (this.state.phase === GamePhase.Ended) return null;

    // 断线者判负：找对方阵营的赢家
    const disconnected = this.getPlayerState(playerId);
    if (!disconnected) return null;

    // 如果还在叫分阶段，先强制分配角色
    if (this.state.phase === GamePhase.Calling) {
      // 断线者为地主（判负），其他人为农民
      for (const p of this.state.players) {
        p.role = p.playerId === playerId ? PlayerRole.Landlord : PlayerRole.Peasant;
      }
      this.state.phase = GamePhase.Playing;
    }

    if (disconnected.role === PlayerRole.Landlord) {
      // 地主断线，农民赢
      const peasant = this.state.players.find(
        (p) => p.role === PlayerRole.Peasant,
      )!;
      return this.endGame(peasant.playerId);
    } else {
      // 农民断线，地主赢
      const landlord = this.state.players.find(
        (p) => p.role === PlayerRole.Landlord,
      )!;
      return this.endGame(landlord.playerId);
    }
  }

  // ===================== 状态快照 =====================

  /** 获取某个玩家视角的完整状态快照（用于 syncState） */
  getFullState(playerId: string): DoudizhuSnapshot {
    const me = this.getPlayerState(playerId);

    return {
      roomId: this.state.roomId,
      gameId: this.state.gameId,
      modeId: this.state.modeId,
      phase: this.state.phase,
      myHand: me ? [...me.hand] : [],
      myRole: me?.role ?? null,
      currentTurn: this.state.phase === GamePhase.Calling
        ? this.state.players[this.callerIndex]?.playerId ?? null
        : this.state.currentTurn,
      lastPlay: this.state.lastPlay
        ? { playerId: this.state.lastPlay.playerId, play: this.state.lastPlay.play }
        : null,
      consecutivePasses: this.state.consecutivePasses,
      bottomCards: this.state.players.some((p) => p.role === PlayerRole.Landlord)
        ? [...this.state.bottomCards]
        : [],
      baseBid: this.state.baseBid,
      bombCount: this.state.bombCount,
      rocketUsed: this.state.rocketUsed,
      players: this.state.players.map((p) => ({
        playerId: p.playerId,
        playerName: p.playerName,
        playerType: p.playerType,
        role: p.role,
        cardCount: p.hand.length,
        isOnline: p.isOnline,
      })),
      callSequence: [...this.state.callSequence],
      tracker: buildCardTrackerSnapshot({
        myHand: me ? [...me.hand] : [],
        history: this.trackerHistory,
      }),
      wildcardRank: this.state.wildcardRank,
    };
  }
}
