import { describe, it, expect, beforeEach } from "vitest";
import { GameManager, type GamePlayer } from "../game/GameManager.js";
import {
  GamePhase,
  PlayerRole,
  Rank,
  Suit,
  type Card,
  CardType,
} from "@blitzlord/shared";

const PLAYERS: GamePlayer[] = [
  { playerId: "p1", playerName: "Alice" },
  { playerId: "p2", playerName: "Bob" },
  { playerId: "p3", playerName: "Carol" },
];

function createGame(): GameManager {
  return new GameManager("room-1", PLAYERS);
}

function findTrackerStat(
  snapshot: ReturnType<GameManager["getFullState"]>,
  rank: Rank,
) {
  return snapshot.tracker.remainingByRank.find((entry) => entry.rank === rank);
}

describe("GameManager", () => {
  describe("初始化", () => {
    it("创建后应进入叫分阶段", () => {
      const gm = createGame();
      expect(gm.phase).toBe(GamePhase.Calling);
    });

    it("每个玩家应有 17 张牌", () => {
      const gm = createGame();
      for (const p of PLAYERS) {
        expect(gm.getPlayerHand(p.playerId)).toHaveLength(17);
      }
    });

    it("底牌应有 3 张", () => {
      const gm = createGame();
      expect(gm.bottomCards).toHaveLength(3);
    });

    it("应有一个叫分者", () => {
      const gm = createGame();
      expect(gm.currentCallerId).toBeTruthy();
      expect(PLAYERS.some((p) => p.playerId === gm.currentCallerId)).toBe(true);
    });

    it("必须 3 个玩家", () => {
      expect(() => new GameManager("room-1", [PLAYERS[0], PLAYERS[1]])).toThrow();
    });
  });

  describe("叫分阶段", () => {
    it("叫 3 分应直接成为地主", () => {
      const gm = createGame();
      const caller = gm.currentCallerId!;
      const result = gm.callBid(caller, 3);
      expect(result.ok).toBe(true);
      expect(result.landlord).toBeTruthy();
      expect(result.landlord!.playerId).toBe(caller);
      expect(result.landlord!.baseBid).toBe(3);
      expect(gm.phase).toBe(GamePhase.Playing);
    });

    it("地主应拿到底牌（共 20 张）", () => {
      const gm = createGame();
      const caller = gm.currentCallerId!;
      gm.callBid(caller, 3);
      expect(gm.getPlayerHand(caller)).toHaveLength(20);
    });

    it("非当前叫分者不能叫分", () => {
      const gm = createGame();
      const caller = gm.currentCallerId!;
      const other = PLAYERS.find((p) => p.playerId !== caller)!;
      const result = gm.callBid(other.playerId, 1);
      expect(result.ok).toBe(false);
    });

    it("叫分必须递增", () => {
      const gm = createGame();
      const c1 = gm.currentCallerId!;
      gm.callBid(c1, 2);
      const c2 = gm.currentCallerId!;
      // 叫 1 分应失败（不大于当前最高 2 分）
      const result = gm.callBid(c2, 1);
      expect(result.ok).toBe(false);
    });

    it("不叫（bid=0）应轮到下一个人", () => {
      const gm = createGame();
      const c1 = gm.currentCallerId!;
      const result = gm.callBid(c1, 0);
      expect(result.ok).toBe(true);
      expect(result.nextCaller).toBeTruthy();
      expect(result.nextCaller).not.toBe(c1);
    });

    it("三人都不叫应重新发牌", () => {
      const gm = createGame();
      const c1 = gm.currentCallerId!;
      gm.callBid(c1, 0);
      const c2 = gm.currentCallerId!;
      gm.callBid(c2, 0);
      const c3 = gm.currentCallerId!;
      const result = gm.callBid(c3, 0);
      expect(result.ok).toBe(true);
      expect(result.redeal).toBe(true);
      expect(gm.phase).toBe(GamePhase.Calling);
    });

    it("三轮都不叫应强制指定地主", () => {
      const gm = createGame();

      // 第一轮全不叫
      for (let i = 0; i < 3; i++) {
        gm.callBid(gm.currentCallerId!, 0);
      }
      // 第二轮全不叫
      for (let i = 0; i < 3; i++) {
        gm.callBid(gm.currentCallerId!, 0);
      }
      // 第三轮全不叫 → 强制指定
      for (let i = 0; i < 2; i++) {
        gm.callBid(gm.currentCallerId!, 0);
      }
      const result = gm.callBid(gm.currentCallerId!, 0);
      expect(result.ok).toBe(true);
      expect(result.landlord).toBeTruthy();
      expect(result.landlord!.baseBid).toBe(1);
      expect(gm.phase).toBe(GamePhase.Playing);
    });

    it("一人叫 1 其余不叫应成为地主", () => {
      const gm = createGame();
      const c1 = gm.currentCallerId!;
      gm.callBid(c1, 1);
      const c2 = gm.currentCallerId!;
      gm.callBid(c2, 0);
      const c3 = gm.currentCallerId!;
      const result = gm.callBid(c3, 0);
      expect(result.ok).toBe(true);
      expect(result.landlord).toBeTruthy();
      expect(result.landlord!.playerId).toBe(c1);
      expect(result.landlord!.baseBid).toBe(1);
    });
  });

  describe("出牌阶段", () => {
    function setupPlaying(gm: GameManager): string {
      const caller = gm.currentCallerId!;
      gm.callBid(caller, 1);
      // 第二、三个人不叫
      const c2 = gm.currentCallerId!;
      if (c2) gm.callBid(c2, 0);
      const c3 = gm.currentCallerId!;
      if (c3) gm.callBid(c3, 0);
      return caller; // 地主
    }

    it("地主先出牌", () => {
      const gm = createGame();
      const landlord = setupPlaying(gm);
      expect(gm.currentTurn).toBe(landlord);
    });

    it("出一张有效牌应成功", () => {
      const gm = createGame();
      const landlord = setupPlaying(gm);
      const hand = gm.getPlayerHand(landlord);
      const card = hand[hand.length - 1]; // 最小的牌
      const result = gm.playCards(landlord, [card]);
      expect(result.ok).toBe(true);
      expect(result.play).toBeDefined();
      expect(result.remainingCards).toBe(19); // 20 - 1
    });

    it("非当前轮次不能出牌", () => {
      const gm = createGame();
      const landlord = setupPlaying(gm);
      const other = PLAYERS.find((p) => p.playerId !== landlord)!;
      const hand = gm.getPlayerHand(other.playerId);
      const result = gm.playCards(other.playerId, [hand[0]]);
      expect(result.ok).toBe(false);
    });

    it("pass 后轮次应转移", () => {
      const gm = createGame();
      const landlord = setupPlaying(gm);
      // 地主出牌
      const hand = gm.getPlayerHand(landlord);
      gm.playCards(landlord, [hand[hand.length - 1]]);
      // 下一位 pass
      const next = gm.currentTurn!;
      const result = gm.pass(next);
      expect(result.ok).toBe(true);
      expect(result.nextTurn).toBeTruthy();
      expect(result.nextTurn).not.toBe(next);
    });

    it("控牌者不能 pass", () => {
      const gm = createGame();
      const landlord = setupPlaying(gm);
      // 地主是控牌者，不能 pass
      const result = gm.pass(landlord);
      expect(result.ok).toBe(false);
    });

    it("连续 2 人 pass 后控牌权回到上个出牌者", () => {
      const gm = createGame();
      const landlord = setupPlaying(gm);
      // 地主出牌
      const hand = gm.getPlayerHand(landlord);
      gm.playCards(landlord, [hand[hand.length - 1]]);
      // 下家 pass
      const firstPass = gm.pass(gm.currentTurn!);
      expect(firstPass.resetRound).toBe(false);
      // 再下家 pass
      const result = gm.pass(gm.currentTurn!);
      expect(result.ok).toBe(true);
      expect(result.nextTurn).toBe(landlord);
      expect(result.resetRound).toBe(true);
      // 此时 lastPlay 应为 null（自由出牌）
      expect(gm.lastPlay).toBeNull();
    });
  });

  describe("炸弹和火箭记录", () => {
    it("初始 bombCount 为 0，rocketUsed 为 false", () => {
      const gm = createGame();
      const caller = gm.currentCallerId!;
      gm.callBid(caller, 3);
      const snap = gm.getFullState(caller);
      expect(snap.bombCount).toBe(0);
      expect(snap.rocketUsed).toBe(false);
    });

    it("出炸弹应增加 bombCount", () => {
      const gm = createGame();
      const caller = gm.currentCallerId!;
      gm.callBid(caller, 3);
      const hand = gm.getPlayerHand(caller);

      // 在手牌中找四张相同 rank 的牌（炸弹）
      const rankCounts = new Map<Rank, Card[]>();
      for (const c of hand) {
        const arr = rankCounts.get(c.rank) ?? [];
        arr.push(c);
        rankCounts.set(c.rank, arr);
      }
      const bomb = [...rankCounts.values()].find((arr) => arr.length === 4);

      if (bomb) {
        const result = gm.playCards(caller, bomb);
        expect(result.ok).toBe(true);
        expect(result.play!.type).toBe(CardType.Bomb);
        const snap = gm.getFullState(caller);
        expect(snap.bombCount).toBe(1);
      }
      // 如果手牌中没有炸弹，测试跳过（随机牌）
    });

    it("出火箭应标记 rocketUsed", () => {
      const gm = createGame();
      const caller = gm.currentCallerId!;
      gm.callBid(caller, 3);
      const hand = gm.getPlayerHand(caller);

      const hasBlackJoker = hand.some((c) => c.rank === Rank.BlackJoker);
      const hasRedJoker = hand.some((c) => c.rank === Rank.RedJoker);

      if (hasBlackJoker && hasRedJoker) {
        const rocket = hand.filter(
          (c) => c.rank === Rank.BlackJoker || c.rank === Rank.RedJoker,
        );
        const result = gm.playCards(caller, rocket);
        expect(result.ok).toBe(true);
        expect(result.play!.type).toBe(CardType.Rocket);
        const snap = gm.getFullState(caller);
        expect(snap.rocketUsed).toBe(true);
      }
      // 如果手牌中没有火箭，测试跳过（随机牌）
    });
  });

  describe("getFullState (状态快照)", () => {
    it("应包含正确的玩家视角信息", () => {
      const gm = createGame();
      const caller = gm.currentCallerId!;
      const snapshot = gm.getFullState(caller);

      expect(snapshot.roomId).toBe("room-1");
      expect(snapshot.phase).toBe(GamePhase.Calling);
      expect(snapshot.myHand).toHaveLength(17);
      expect(snapshot.players).toHaveLength(3);

      // 其他玩家只有牌数
      const otherPlayer = snapshot.players.find((p) => p.playerId !== caller)!;
      expect(otherPlayer.cardCount).toBe(17);
    });

    it("叫分阶段 currentTurn 应为当前叫分者", () => {
      const gm = createGame();
      const caller = gm.currentCallerId!;
      const snapshot = gm.getFullState(caller);
      expect(snapshot.currentTurn).toBe(caller);
    });

    it("叫分阶段 baseBid 应为 0", () => {
      const gm = createGame();
      const caller = gm.currentCallerId!;
      const snapshot = gm.getFullState(caller);
      expect(snapshot.baseBid).toBe(0);
    });

    it("确定地主后 bottomCards 应有值", () => {
      const gm = createGame();
      const caller = gm.currentCallerId!;
      gm.callBid(caller, 3);
      const snapshot = gm.getFullState(caller);
      expect(snapshot.bottomCards).toHaveLength(3);
      expect(snapshot.myHand).toHaveLength(20); // 地主 20 张
    });

    it("未确定地主前 bottomCards 应为空数组", () => {
      const gm = createGame();
      const caller = gm.currentCallerId!;
      const snapshot = gm.getFullState(caller);
      expect(snapshot.bottomCards).toHaveLength(0);
    });
  });

  describe("tracker snapshot", () => {
    function setupTrackerPlaying(gm: GameManager): string {
      const caller = gm.currentCallerId!;
      gm.callBid(caller, 1);
      const c2 = gm.currentCallerId!;
      if (c2) gm.callBid(c2, 0);
      const c3 = gm.currentCallerId!;
      if (c3) gm.callBid(c3, 0);
      return caller;
    }

    it("includes tracker history and remaining counts in getFullState", () => {
      const gm = createGame();
      const landlord = setupTrackerPlaying(gm);
      const playedCard = gm.getPlayerHand(landlord)[0];

      const playResult = gm.playCards(landlord, [playedCard]);
      expect(playResult.ok).toBe(true);

      const snapshot = gm.getFullState(landlord);
      const stat = findTrackerStat(snapshot, playedCard.rank);

      expect(snapshot.tracker.history).toHaveLength(1);
      expect(snapshot.tracker.history[0]).toMatchObject({
        sequence: 1,
        round: 1,
        playerId: landlord,
        action: "play",
        cards: [playedCard],
      });
      expect(stat).toMatchObject({
        rank: playedCard.rank,
        playedCopies: 1,
      });
    });

    it("records pass in history without changing remaining stats", () => {
      const gm = createGame();
      const landlord = setupTrackerPlaying(gm);
      const playedCard = gm.getPlayerHand(landlord)[0];

      gm.playCards(landlord, [playedCard]);
      const beforePass = gm.getFullState(landlord);

      const passPlayer = gm.currentTurn!;
      const passResult = gm.pass(passPlayer);
      expect(passResult.ok).toBe(true);

      const afterPass = gm.getFullState(landlord);

      expect(afterPass.tracker.history).toHaveLength(2);
      expect(afterPass.tracker.history[1]).toMatchObject({
        sequence: 2,
        round: 1,
        playerId: passPlayer,
        action: "pass",
        cards: [],
      });
      expect(afterPass.tracker.remainingByRank).toEqual(beforePass.tracker.remainingByRank);
    });

    it("starts a new tracker round after two passes reset control", () => {
      const gm = createGame();
      const landlord = setupTrackerPlaying(gm);
      const firstPlay = gm.getPlayerHand(landlord)[0];

      gm.playCards(landlord, [firstPlay]);
      gm.pass(gm.currentTurn!);
      gm.pass(gm.currentTurn!);

      const nextPlay = gm.getPlayerHand(landlord)[0];
      const nextPlayResult = gm.playCards(landlord, [nextPlay]);
      expect(nextPlayResult.ok).toBe(true);

      const snapshot = gm.getFullState(landlord);
      expect(snapshot.tracker.history[2]).toMatchObject({
        sequence: 3,
        round: 1,
        action: "pass",
      });
      expect(snapshot.tracker.history.at(-1)).toMatchObject({
        sequence: 4,
        round: 2,
        playerId: landlord,
        action: "play",
        cards: [nextPlay],
      });
    });

    it("clears tracker history when dealing a new round", () => {
      const gm = createGame();
      const landlord = setupTrackerPlaying(gm);
      const playedCard = gm.getPlayerHand(landlord)[0];

      gm.playCards(landlord, [playedCard]);
      expect(gm.getFullState(landlord).tracker.history).toHaveLength(1);

      (gm as unknown as { deal: () => void }).deal();

      const snapshot = gm.getFullState(landlord);
      expect(snapshot.tracker.history).toEqual([]);
    });
  });

  describe("断线超时", () => {
    it("出牌阶段断线应判对方赢", () => {
      const gm = createGame();
      const caller = gm.currentCallerId!;
      gm.callBid(caller, 3); // caller 是地主

      const result = gm.handleDisconnectTimeout(caller);
      expect(result).toBeTruthy();
      expect(result!.winnerRole).toBe(PlayerRole.Peasant);
      expect(gm.phase).toBe(GamePhase.Ended);
    });

    it("农民断线应地主赢", () => {
      const gm = createGame();
      const caller = gm.currentCallerId!;
      gm.callBid(caller, 3);

      const peasant = PLAYERS.find((p) => p.playerId !== caller)!;
      const result = gm.handleDisconnectTimeout(peasant.playerId);
      expect(result).toBeTruthy();
      expect(result!.winnerRole).toBe(PlayerRole.Landlord);
    });

    it("叫分阶段断线应强制分配角色并判负", () => {
      const gm = createGame();
      const caller = gm.currentCallerId!;
      // 不叫分，直接超时
      const result = gm.handleDisconnectTimeout(caller);
      expect(result).toBeTruthy();
      expect(gm.phase).toBe(GamePhase.Ended);
    });

    it("游戏已结束再超时应返回 null", () => {
      const gm = createGame();
      const caller = gm.currentCallerId!;
      gm.callBid(caller, 3);
      gm.handleDisconnectTimeout(caller);

      const result = gm.handleDisconnectTimeout(caller);
      expect(result).toBeNull();
    });
  });

  describe("完整游戏流程", () => {
    function setupPlaying2(gm: GameManager): string {
      const caller = gm.currentCallerId!;
      gm.callBid(caller, 1);
      const c2 = gm.currentCallerId!;
      if (c2) gm.callBid(c2, 0);
      const c3 = gm.currentCallerId!;
      if (c3) gm.callBid(c3, 0);
      return caller;
    }

    it("地主出完所有牌应触发游戏结束", () => {
      const gm = createGame();
      const landlord = setupPlaying2(gm);

      // 地主一张一张出牌直到出完（其他人全 pass）
      let turn = 0;
      while (gm.phase === GamePhase.Playing && turn < 100) {
        const current = gm.currentTurn!;
        if (current === landlord) {
          const hand = gm.getPlayerHand(landlord);
          if (hand.length === 0) break;
          // 自由出牌或有上家牌
          const card = hand[hand.length - 1];
          const result = gm.playCards(landlord, [card]);
          if (!result.ok) {
            // 牌打不过上家，尝试 pass（不应该发生在自由出牌时）
            gm.pass(landlord);
          }
          if (result.gameEnd) {
            expect(result.gameEnd.winnerRole).toBe(PlayerRole.Landlord);
            expect(result.gameEnd.scores[landlord].finalScore).toBeGreaterThan(0);
            // 农民应为负分
            for (const p of PLAYERS) {
              if (p.playerId !== landlord) {
                expect(result.gameEnd.scores[p.playerId].finalScore).toBeLessThan(0);
              }
            }
            break;
          }
        } else {
          // 其他人 pass
          const passResult = gm.pass(current);
          if (!passResult.ok) {
            // 控牌者必须出牌
            const hand = gm.getPlayerHand(current);
            gm.playCards(current, [hand[hand.length - 1]]);
          }
        }
        turn++;
      }
      expect(gm.phase).toBe(GamePhase.Ended);
    });

    it("计分应根据 baseBid 正确计算", () => {
      const gm = createGame();
      const caller = gm.currentCallerId!;
      gm.callBid(caller, 2); // baseBid = 2
      const c2 = gm.currentCallerId!;
      if (c2) gm.callBid(c2, 0);
      const c3 = gm.currentCallerId!;
      if (c3) gm.callBid(c3, 0);

      // 断线结束来验证计分（baseBid=2, 无炸弹/火箭/春天）
      const peasant = PLAYERS.find((p) => p.playerId !== caller)!;
      const result = gm.handleDisconnectTimeout(peasant.playerId);
      expect(result).toBeTruthy();
      // 地主赢, baseBid=2, 无额外倍率 → finalScore=2
      // 地主得 2*2=4, 农民各扣 -2
      expect(result!.scores[caller].baseBid).toBe(2);
      expect(result!.scores[caller].finalScore).toBe(4);
      for (const p of PLAYERS) {
        if (p.playerId !== caller) {
          expect(result!.scores[p.playerId].finalScore).toBe(-2);
        }
      }
    });
  });

  describe("春天误判回归测试", () => {
    it("叫分阶段断线超时不应误判为春天", () => {
      const gm = createGame();
      const caller = gm.currentCallerId!;
      // 直接超时（叫分阶段）
      const result = gm.handleDisconnectTimeout(caller);
      expect(result).toBeTruthy();
      // baseBid=1, 无春天 → finalScore=1
      expect(result!.scores[caller].isSpring).toBe(false);
      expect(result!.scores[caller].finalScore).toBe(-2); // 断线者为地主，地主扣 2
    });

    it("出牌阶段断线但无人出过牌不应判春天", () => {
      const gm = createGame();
      const caller = gm.currentCallerId!;
      gm.callBid(caller, 1);
      const c2 = gm.currentCallerId!;
      if (c2) gm.callBid(c2, 0);
      const c3 = gm.currentCallerId!;
      if (c3) gm.callBid(c3, 0);

      // 进入出牌阶段但未出牌就断线
      const result = gm.handleDisconnectTimeout(caller);
      expect(result).toBeTruthy();
      expect(result!.scores[caller].isSpring).toBe(false);
    });
  });

  describe("setPlayerOnline", () => {
    it("应正确设置玩家在线状态", () => {
      const gm = createGame();
      gm.setPlayerOnline("p1", false);
      const snapshot = gm.getFullState("p2");
      const p1 = snapshot.players.find((p) => p.playerId === "p1")!;
      expect(p1.isOnline).toBe(false);
    });
  });
});
