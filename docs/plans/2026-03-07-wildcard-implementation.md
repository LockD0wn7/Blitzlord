# 赖子模式实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为斗地主增加赖子（万能牌）玩法模式，包括规则引擎扩展、房间投票切换、前后端联调。

**Architecture:** 在现有规则引擎函数中增加可选 `wildcardRank` 参数，赖子模式下扩展牌型识别、比较、提示逻辑。房间增加 `wildcard` 设置和投票切换机制。前端增加赖子视觉标记和模式切换 UI。

**Tech Stack:** TypeScript, Vitest, Socket.IO, React, Zustand, Tailwind CSS

---

## Task 1: 类型与常量扩展

**Files:**
- Modify: `packages/shared/src/types/card.ts:48-53`
- Modify: `packages/shared/src/types/game.ts:24-37,69-90`
- Modify: `packages/shared/src/types/room.ts:23-29`
- Modify: `packages/shared/src/types/events.ts`
- Modify: `packages/shared/src/constants/card.ts`

**Step 1: 扩展 CardPlay 类型**

在 `packages/shared/src/types/card.ts` 的 `CardPlay` 接口中添加：

```typescript
interface CardPlay {
  type: CardType;
  cards: Card[];
  mainRank: Rank;
  length?: number;
  softBomb?: boolean;   // 软炸（赖子参与的炸弹）
  pureWild?: boolean;   // 纯赖子炸（4张赖子）
}
```

**Step 2: 扩展 GameState 和 GameSnapshot**

在 `packages/shared/src/types/game.ts` 的 `GameState` 中添加：

```typescript
wildcardRank: Rank | null;  // 赖子点数，非赖子模式为 null
```

在 `GameSnapshot` 中同样添加 `wildcardRank: Rank | null`。

**Step 3: 扩展 RoomDetail**

在 `packages/shared/src/types/room.ts` 的 `RoomDetail` 和 `RoomInfo` 中添加：

```typescript
wildcard: boolean;  // 是否启用赖子模式
```

**Step 4: 扩展 Socket 事件类型**

在 `packages/shared/src/types/events.ts` 中：

- `room:create` 参数添加 `wildcard?: boolean`
- `game:landlordDecided` 数据添加 `wildcardRank: Rank | null`
- 新增 `room:voteMode` 事件（发起投票）和 `room:voteModeResult`（投票结果）

```typescript
// ClientEvents 新增
'room:voteMode': (data: { wildcard: boolean }, cb: (res: { ok: boolean; error?: string }) => void) => void;
'room:voteModeVote': (data: { agree: boolean }, cb: (res: { ok: boolean; error?: string }) => void) => void;

// ServerEvents 新增
'room:voteModeStarted': (data: { initiator: string; wildcard: boolean }) => void;
'room:voteModeResult': (data: { passed: boolean; wildcard: boolean }) => void;
```

**Step 5: 添加赖子模式顺子常量**

在 `packages/shared/src/constants/card.ts` 中新增：

```typescript
// 赖子模式下的顺子范围（3~2，含2）
export const WILDCARD_SEQUENCE_RANKS: readonly Rank[] = [
  Rank.Three, Rank.Four, Rank.Five, Rank.Six, Rank.Seven,
  Rank.Eight, Rank.Nine, Rank.Ten, Rank.Jack, Rank.Queen,
  Rank.King, Rank.Ace, Rank.Two,
] as const;
```

**Step 6: 确保类型导出**

检查 `packages/shared/src/types/index.ts` 和 `packages/shared/src/constants/index.ts`，确保新增类型和常量正确导出。

**Step 7: 提交**

```bash
git add packages/shared/src/types/ packages/shared/src/constants/
git commit -m "feat: 添加赖子模式类型定义和常量"
```

---

## Task 2: identifyCardType 赖子支持

**Files:**
- Modify: `packages/shared/src/rules/cardType.ts`
- Create: `packages/shared/src/__tests__/wildcardCardType.test.ts`

这是最核心也最复杂的变更。需要在现有 `identifyCardType` 基础上支持赖子万能牌。

**Step 1: 编写基础赖子牌型识别测试**

```typescript
// packages/shared/src/__tests__/wildcardCardType.test.ts
import { describe, it, expect } from 'vitest';
import { identifyCardType } from '../rules/cardType.js';
import { Rank, Suit, CardType } from '../types/card.js';

const c = (rank: Rank, suit: Suit | null = Suit.Spade) => ({ rank, suit });

describe('identifyCardType with wildcard', () => {
  const WR = Rank.Seven; // 赖子点数=7

  describe('赖子当普通牌使用', () => {
    it('单张赖子牌当原始点数', () => {
      const play = identifyCardType([c(Rank.Seven)], WR);
      expect(play).not.toBeNull();
      expect(play!.type).toBe(CardType.Single);
      expect(play!.mainRank).toBe(Rank.Seven);
    });

    it('两张赖子当一对7', () => {
      const play = identifyCardType(
        [c(Rank.Seven, Suit.Spade), c(Rank.Seven, Suit.Heart)], WR
      );
      expect(play).not.toBeNull();
      expect(play!.type).toBe(CardType.Pair);
    });
  });

  describe('赖子当万能牌使用', () => {
    it('赖子+8 组成一对8', () => {
      const play = identifyCardType(
        [c(Rank.Seven), c(Rank.Eight)], WR
      );
      expect(play).not.toBeNull();
      expect(play!.type).toBe(CardType.Pair);
      expect(play!.mainRank).toBe(Rank.Eight);
    });

    it('赖子+KK 组成三条K', () => {
      const play = identifyCardType(
        [c(Rank.Seven), c(Rank.King, Suit.Spade), c(Rank.King, Suit.Heart)], WR
      );
      expect(play).not.toBeNull();
      expect(play!.type).toBe(CardType.Triple);
      expect(play!.mainRank).toBe(Rank.King);
    });

    it('赖子+AAA 组成炸弹A（软炸）', () => {
      const play = identifyCardType(
        [c(Rank.Seven), c(Rank.Ace, Suit.Spade), c(Rank.Ace, Suit.Heart), c(Rank.Ace, Suit.Diamond)], WR
      );
      expect(play).not.toBeNull();
      expect(play!.type).toBe(CardType.Bomb);
      expect(play!.mainRank).toBe(Rank.Ace);
      expect(play!.softBomb).toBe(true);
    });
  });

  describe('纯赖子炸', () => {
    it('4张赖子 = 纯赖子炸', () => {
      const play = identifyCardType([
        c(Rank.Seven, Suit.Spade), c(Rank.Seven, Suit.Heart),
        c(Rank.Seven, Suit.Diamond), c(Rank.Seven, Suit.Club),
      ], WR);
      expect(play).not.toBeNull();
      expect(play!.type).toBe(CardType.Bomb);
      expect(play!.pureWild).toBe(true);
    });
  });

  describe('赖子模式下2可以入顺子', () => {
    it('10-J-Q-K-A-2 六连顺', () => {
      const play = identifyCardType([
        c(Rank.Ten), c(Rank.Jack), c(Rank.Queen),
        c(Rank.King), c(Rank.Ace), c(Rank.Two),
      ], WR);
      expect(play).not.toBeNull();
      expect(play!.type).toBe(CardType.Straight);
      expect(play!.length).toBe(6);
    });

    it('赖子补缺组成含2的顺子', () => {
      // 赖子(=7) + 10 J Q K A 2 → 赖子替代某张缺失牌? 不对，这里都有了
      // 改成: 赖子 + J Q K A 2 → 赖子替代10, 顺子10-J-Q-K-A-2
      const play = identifyCardType([
        c(Rank.Seven), c(Rank.Jack), c(Rank.Queen),
        c(Rank.King), c(Rank.Ace), c(Rank.Two),
      ], WR);
      expect(play).not.toBeNull();
      expect(play!.type).toBe(CardType.Straight);
      expect(play!.length).toBe(6);
    });
  });

  describe('无赖子模式下行为不变', () => {
    it('wildcardRank=null 时行为与原来一致', () => {
      const play = identifyCardType([c(Rank.Five)], null);
      expect(play).not.toBeNull();
      expect(play!.type).toBe(CardType.Single);
    });

    it('不传 wildcardRank 时行为与原来一致', () => {
      const play = identifyCardType([c(Rank.Five)]);
      expect(play).not.toBeNull();
      expect(play!.type).toBe(CardType.Single);
    });
  });
});
```

**Step 2: 运行测试确认失败**

```bash
pnpm test:shared -- --run wildcardCardType
```

预期：编译错误或测试失败（`identifyCardType` 还不接受第二个参数）。

**Step 3: 实现 identifyCardType 赖子支持**

在 `packages/shared/src/rules/cardType.ts` 中：

1. 函数签名改为 `identifyCardType(cards: Card[], wildcardRank?: Rank | null): CardPlay | null`
2. 新增辅助函数 `isWildcard(card, wildcardRank)` 判断一张牌是否为赖子
3. 新增辅助函数 `splitWildcards(cards, wildcardRank)` 将牌分为自然牌和赖子牌
4. 当 `wildcardRank` 为空或 `null` 时，走原有逻辑（向后兼容）
5. 当有赖子时：
   - 先检查是否为火箭（大小王不受赖子影响）
   - 检查纯赖子炸（4张全是赖子）
   - 对于其他牌型，将赖子视为万能牌枚举：
     - 自然牌先分组，赖子逐张尝试补到各 rank 上
     - 尝试所有可能的牌型匹配
   - 序列判断使用 `WILDCARD_SEQUENCE_RANKS`（含2）代替 `SEQUENCE_RANKS`
6. 对识别出的 Bomb 标记 `softBomb: true`（含赖子）或 `pureWild: true`（纯赖子）

**核心算法思路：**

```typescript
function identifyCardTypeWithWild(
  naturalCards: Card[],
  wildCards: Card[],
  allCards: Card[],
  wildcardRank: Rank
): CardPlay | null {
  const wildCount = wildCards.length;

  // 1. 纯赖子炸
  if (wildCount === 4) {
    return { type: CardType.Bomb, cards: allCards, mainRank: wildcardRank, pureWild: true };
  }

  // 2. 尝试各种牌型，赖子作为万能牌补位
  //    对每种牌型，计算需要多少张赖子来补齐，是否 <= wildCount

  // 对于单张/对子/三条/炸弹：
  //   自然牌已有 N 张相同 rank，需要 (target - N) 张赖子
  //   遍历所有可能的 target rank (3~2)

  // 对于顺子/连对/飞机：
  //   使用 WILDCARD_SEQUENCE_RANKS
  //   遍历所有可能的起始位置和长度
  //   对每个位置检查缺少的牌数，用赖子补

  // 对于带牌型（三带一、四带二等）：
  //   主体部分用赖子补，翼牌部分也可能用赖子

  // 返回所有可能的牌型（不剪枝）
}
```

**Step 4: 运行测试确认通过**

```bash
pnpm test:shared -- --run wildcardCardType
```

**Step 5: 补充更多边界测试**

添加测试覆盖：
- 赖子+顺子的各种组合
- 赖子+连对
- 赖子+飞机（带/不带翼）
- 赖子+四带二
- 3张赖子+1张普通牌（多种可能牌型）
- 2张赖子+2张不同普通牌（可能组成多种牌型）
- 大小王不受赖子影响（火箭仍需真正的大小王）

**Step 6: 运行全部测试确认不破坏现有逻辑**

```bash
pnpm test:shared -- --run
```

**Step 7: 提交**

```bash
git add packages/shared/src/rules/cardType.ts packages/shared/src/__tests__/wildcardCardType.test.ts
git commit -m "feat: identifyCardType 支持赖子牌型识别"
```

---

## Task 3: canBeat 赖子炸弹层级

**Files:**
- Modify: `packages/shared/src/rules/cardCompare.ts`
- Create: `packages/shared/src/__tests__/wildcardCompare.test.ts`

**Step 1: 编写赖子炸弹比较测试**

```typescript
// packages/shared/src/__tests__/wildcardCompare.test.ts
import { describe, it, expect } from 'vitest';
import { canBeat } from '../rules/cardCompare.js';
import { Rank, Suit, CardType, CardPlay } from '../types/card.js';

const bomb = (rank: Rank, soft = false, pure = false): CardPlay => ({
  type: CardType.Bomb,
  cards: [],  // 比较不需要实际 cards
  mainRank: rank,
  softBomb: soft || undefined,
  pureWild: pure || undefined,
});

const rocket: CardPlay = {
  type: CardType.Rocket,
  cards: [],
  mainRank: Rank.RedJoker,
};

describe('canBeat with wildcard bombs', () => {
  it('火箭 > 纯赖子炸', () => {
    expect(canBeat(rocket, bomb(Rank.Seven, false, true))).toBe(true);
  });

  it('纯赖子炸 > 硬炸', () => {
    expect(canBeat(bomb(Rank.Seven, false, true), bomb(Rank.Two))).toBe(true);
  });

  it('硬炸 > 软炸（同点数）', () => {
    expect(canBeat(bomb(Rank.Ace), bomb(Rank.Ace, true))).toBe(true);
  });

  it('硬炸 > 软炸（软炸点数更大）', () => {
    expect(canBeat(bomb(Rank.Three), bomb(Rank.Two, true))).toBe(true);
  });

  it('软炸之间按点数比较', () => {
    expect(canBeat(bomb(Rank.Ace, true), bomb(Rank.King, true))).toBe(true);
    expect(canBeat(bomb(Rank.King, true), bomb(Rank.Ace, true))).toBe(false);
  });

  it('软炸可以压非炸弹', () => {
    const single: CardPlay = { type: CardType.Single, cards: [], mainRank: Rank.Two };
    expect(canBeat(bomb(Rank.Three, true), single)).toBe(true);
  });

  it('纯赖子炸不能压火箭', () => {
    expect(canBeat(bomb(Rank.Seven, false, true), rocket)).toBe(false);
  });
});
```

**Step 2: 运行测试确认失败**

```bash
pnpm test:shared -- --run wildcardCompare
```

**Step 3: 实现 canBeat 赖子炸弹层级**

在 `packages/shared/src/rules/cardCompare.ts` 中扩展比较逻辑：

```typescript
// 炸弹内部细分优先级
function getBombPriority(play: CardPlay): number {
  if (play.pureWild) return 2;    // 纯赖子炸
  if (play.softBomb) return 0;    // 软炸
  return 1;                        // 硬炸
}
```

在 `canBeat` 函数中，当两个都是 Bomb 时：
1. 先比较 bombPriority
2. priority 相同再比较 mainRank

**Step 4: 运行测试确认通过**

```bash
pnpm test:shared -- --run wildcardCompare
```

**Step 5: 运行全部测试确认不破坏现有逻辑**

```bash
pnpm test:shared -- --run
```

**Step 6: 提交**

```bash
git add packages/shared/src/rules/cardCompare.ts packages/shared/src/__tests__/wildcardCompare.test.ts
git commit -m "feat: canBeat 支持赖子炸弹层级比较"
```

---

## Task 4: validatePlay 透传赖子参数

**Files:**
- Modify: `packages/shared/src/rules/validator.ts`
- Create: `packages/shared/src/__tests__/wildcardValidator.test.ts`

**Step 1: 编写赖子出牌验证测试**

```typescript
// packages/shared/src/__tests__/wildcardValidator.test.ts
import { describe, it, expect } from 'vitest';
import { validatePlay } from '../rules/validator.js';
import { Rank, Suit, CardType } from '../types/card.js';

const c = (rank: Rank, suit: Suit = Suit.Spade) => ({ rank, suit });
const WR = Rank.Seven;

describe('validatePlay with wildcard', () => {
  it('赖子+8 从手牌中出一对8', () => {
    const hand = [c(Rank.Seven), c(Rank.Eight), c(Rank.Three)];
    const cards = [c(Rank.Seven), c(Rank.Eight)];
    const result = validatePlay(cards, hand, null, WR);
    expect(result.valid).toBe(true);
    expect(result.play!.type).toBe(CardType.Pair);
  });

  it('非赖子模式下 7+8 不是合法牌型', () => {
    const hand = [c(Rank.Seven), c(Rank.Eight), c(Rank.Three)];
    const cards = [c(Rank.Seven), c(Rank.Eight)];
    const result = validatePlay(cards, hand, null, null);
    expect(result.valid).toBe(false);
  });
});
```

**Step 2: 运行测试确认失败**

```bash
pnpm test:shared -- --run wildcardValidator
```

**Step 3: 修改 validatePlay 签名**

```typescript
export function validatePlay(
  cards: Card[],
  hand: Card[],
  previousPlay: CardPlay | null,
  wildcardRank?: Rank | null,
): ValidateResult
```

在内部调用 `identifyCardType(cards, wildcardRank)` 时传入 `wildcardRank`。

**Step 4: 运行测试确认通过**

```bash
pnpm test:shared -- --run wildcardValidator
```

**Step 5: 运行全部测试**

```bash
pnpm test:shared -- --run
```

**Step 6: 提交**

```bash
git add packages/shared/src/rules/validator.ts packages/shared/src/__tests__/wildcardValidator.test.ts
git commit -m "feat: validatePlay 支持赖子参数透传"
```

---

## Task 5: getPlayableHints 赖子提示

**Files:**
- Modify: `packages/shared/src/rules/hint.ts`
- Create: `packages/shared/src/__tests__/wildcardHint.test.ts`

这是第二个复杂任务，需要在提示枚举中加入赖子组合。

**Step 1: 编写赖子提示测试**

```typescript
// packages/shared/src/__tests__/wildcardHint.test.ts
import { describe, it, expect } from 'vitest';
import { getPlayableHints } from '../rules/hint.js';
import { Rank, Suit, CardType, CardPlay } from '../types/card.js';

const c = (rank: Rank, suit: Suit = Suit.Spade) => ({ rank, suit });
const WR = Rank.Seven;

describe('getPlayableHints with wildcard', () => {
  it('赖子可以和其他牌组成对子', () => {
    const hand = [c(Rank.Seven), c(Rank.Eight), c(Rank.Three)];
    const hints = getPlayableHints(hand, null, WR);
    const pairs = hints.filter(h => h.type === CardType.Pair);
    // 赖子+8=对8, 赖子+3=对3
    expect(pairs.length).toBeGreaterThanOrEqual(2);
  });

  it('自由出牌时枚举所有赖子组合', () => {
    const hand = [
      c(Rank.Seven, Suit.Spade), c(Rank.Seven, Suit.Heart),
      c(Rank.Eight), c(Rank.Nine),
    ];
    const hints = getPlayableHints(hand, null, WR);
    expect(hints.length).toBeGreaterThan(0);
    // 应包含：单张×4, 对7, 赖子+8=对8, 赖子+9=对9, 两赖子+8=三条8, ...
  });

  it('无赖子模式时行为不变', () => {
    const hand = [c(Rank.Eight), c(Rank.Nine), c(Rank.Three)];
    const hintsNull = getPlayableHints(hand, null, null);
    const hintsUndef = getPlayableHints(hand, null);
    expect(hintsNull).toEqual(hintsUndef);
  });

  it('赖子模式下含2的顺子可被提示', () => {
    const hand = [
      c(Rank.Ten), c(Rank.Jack), c(Rank.Queen),
      c(Rank.King), c(Rank.Ace), c(Rank.Two),
    ];
    const hints = getPlayableHints(hand, null, WR);
    const straights = hints.filter(h => h.type === CardType.Straight);
    // 应包含 10-J-Q-K-A-2 顺子
    expect(straights.some(s => s.length === 6)).toBe(true);
  });
});
```

**Step 2: 运行测试确认失败**

```bash
pnpm test:shared -- --run wildcardHint
```

**Step 3: 实现 getPlayableHints 赖子支持**

修改 `packages/shared/src/rules/hint.ts`：

1. 函数签名改为 `getPlayableHints(hand, previousPlay, wildcardRank?)`
2. 在枚举时将赖子牌单独分出
3. 对每种牌型，在现有自然牌基础上尝试添加赖子组合
4. 序列类型使用 `WILDCARD_SEQUENCE_RANKS`
5. 不剪枝，枚举所有合法组合
6. 使用现有去重机制 `getPlayKey` 避免重复

**Step 4: 运行测试确认通过**

```bash
pnpm test:shared -- --run wildcardHint
```

**Step 5: 补充提示边界测试**

- 4张赖子应产生纯赖子炸提示
- 赖子+三条应产生软炸提示
- 需要压过硬炸时，软炸不出现在提示中（除非点数更大的软炸）
- 赖子可同时产生原始点数牌型和万能牌型

**Step 6: 运行全部测试**

```bash
pnpm test:shared -- --run
```

**Step 7: 提交**

```bash
git add packages/shared/src/rules/hint.ts packages/shared/src/__tests__/wildcardHint.test.ts
git commit -m "feat: getPlayableHints 支持赖子牌型提示枚举"
```

---

## Task 6: GameManager 赖子模式支持

**Files:**
- Modify: `packages/server/src/game/GameManager.ts`
- Modify: `packages/shared/src/rules/index.ts`（确保导出更新）

**Step 1: 编写 GameManager 赖子测试**

在 `packages/server/src/__tests__/` 中添加赖子模式 GameManager 测试：

- 构造 GameManager 时传入 `wildcard: true`
- 确定地主后 `wildcardRank` 非 null
- `playCards` 时赖子牌型被正确识别
- `getFullState` 返回 `wildcardRank`
- 非赖子模式 `wildcardRank` 始终为 null

**Step 2: 运行测试确认失败**

```bash
pnpm test -- --run packages/server
```

**Step 3: 修改 GameManager**

1. 构造函数增加 `wildcard: boolean` 参数
2. `GameState` 增加 `wildcardRank: Rank | null`
3. `decideLandlord` 方法中，若 `wildcard === true`，随机选定 `wildcardRank`：

```typescript
if (this.wildcard) {
  const normalRanks = [
    Rank.Three, Rank.Four, Rank.Five, Rank.Six, Rank.Seven,
    Rank.Eight, Rank.Nine, Rank.Ten, Rank.Jack, Rank.Queen,
    Rank.King, Rank.Ace, Rank.Two,
  ];
  this.state.wildcardRank = normalRanks[Math.floor(Math.random() * normalRanks.length)];
}
```

4. `playCards` 调用 `validatePlay` 时传入 `wildcardRank`
5. `getFullState` 返回 `wildcardRank`
6. 炸弹计数：软炸和纯赖子炸都累加 `bombCount`

**Step 4: 运行测试确认通过**

```bash
pnpm test -- --run packages/server
```

**Step 5: 提交**

```bash
git add packages/server/src/game/GameManager.ts packages/server/src/__tests__/
git commit -m "feat: GameManager 支持赖子模式"
```

---

## Task 7: Room 模式设置与投票机制

**Files:**
- Modify: `packages/server/src/room/Room.ts`

**Step 1: 编写 Room 投票测试**

测试覆盖：
- 创建房间时设置初始 `wildcard` 模式
- 发起投票，记录投票状态
- 2/3 同意即通过
- 投票结果正确改变 `wildcard` 设置
- 游戏进行中不能投票
- 重复投票被拒绝

**Step 2: 运行测试确认失败**

**Step 3: 修改 Room 类**

```typescript
// Room 新增属性
private _wildcard: boolean = false;
private _modeVote: {
  wildcard: boolean;       // 投票目标模式
  initiator: string;       // 发起者 playerId
  votes: Map<string, boolean>;  // playerId → agree
} | null = null;

// 新增方法
get wildcard(): boolean
setWildcard(wildcard: boolean): void         // 仅创建时/投票通过时调用
startModeVote(playerId: string, wildcard: boolean): boolean
castModeVote(playerId: string, agree: boolean): { passed?: boolean; wildcard?: boolean } | null
get modeVote(): { ... } | null
```

- `toRoomInfo()` 和 `toRoomDetail()` 返回 `wildcard` 字段

**Step 4: 运行测试确认通过**

**Step 5: 提交**

```bash
git add packages/server/src/room/Room.ts packages/server/src/__tests__/
git commit -m "feat: Room 支持赖子模式设置和投票切换"
```

---

## Task 8: Socket Handler 赖子事件

**Files:**
- Modify: `packages/server/src/socket/handlers.ts`

**Step 1: 修改 room:create 处理**

接收 `wildcard` 参数，传给 Room 构造。

**Step 2: 修改 game:ready 处理**

创建 GameManager 时传入 `room.wildcard`。

**Step 3: 修改 game:callLandlord 处理**

`game:landlordDecided` 事件增加 `wildcardRank` 字段。

**Step 4: 添加 room:voteMode 和 room:voteModeVote 处理**

```typescript
socket.on('room:voteMode', ({ wildcard }, cb) => {
  // 验证：在房间内、游戏未进行
  // 调用 room.startModeVote()
  // 广播 room:voteModeStarted
});

socket.on('room:voteModeVote', ({ agree }, cb) => {
  // 验证：有进行中的投票
  // 调用 room.castModeVote()
  // 如果投票完成，广播 room:voteModeResult
  // 如果通过，更新 room.wildcard
});
```

**Step 5: 运行全部测试**

```bash
pnpm test -- --run
```

**Step 6: 提交**

```bash
git add packages/server/src/socket/handlers.ts
git commit -m "feat: Socket handler 支持赖子模式事件"
```

---

## Task 9: 客户端 Store 扩展

**Files:**
- Modify: `packages/client/src/store/useGameStore.ts`
- Modify: `packages/client/src/store/useRoomStore.ts`

**Step 1: useGameStore 添加 wildcardRank 状态**

```typescript
// 新增状态
wildcardRank: Rank | null;

// syncState 时同步 wildcardRank
// game:landlordDecided 时设置 wildcardRank
// 游戏结束时重置为 null
```

**Step 2: useRoomStore 添加 wildcard 状态**

`RoomDetail` 已包含 `wildcard` 字段，store 自动跟随。

添加投票相关状态：
```typescript
modeVote: { wildcard: boolean; initiator: string } | null;
```

**Step 3: 提交**

```bash
git add packages/client/src/store/
git commit -m "feat: 客户端 store 支持赖子模式状态"
```

---

## Task 10: 客户端 Socket 事件绑定

**Files:**
- Modify: `packages/client/src/socket/` 相关文件

**Step 1: 绑定新事件**

- `game:landlordDecided` 回调中提取 `wildcardRank` 存入 store
- 绑定 `room:voteModeStarted`、`room:voteModeResult` 事件
- `room:create` 发送时携带 `wildcard` 参数

**Step 2: 提交**

```bash
git add packages/client/src/socket/
git commit -m "feat: 客户端 Socket 绑定赖子模式事件"
```

---

## Task 11: 客户端出牌提示适配

**Files:**
- Modify: `packages/client/src/components/Game/hintAction.ts`
- Modify: `packages/client/src/components/Game/hintState.ts`

**Step 1: hintAction 传入 wildcardRank**

`resolveHintAction` 调用 `getPlayableHints` 时传入 `wildcardRank`。

**Step 2: hintState 上下文键包含 wildcardRank**

`buildHintContextKey` 在序列化时加入 `wildcardRank` 信息，确保赖子点数变化时 hint 缓存重置。

**Step 3: 提交**

```bash
git add packages/client/src/components/Game/
git commit -m "feat: 出牌提示适配赖子模式"
```

---

## Task 12: 前端 UI - 房间创建与模式切换

**Files:**
- Modify: 房间创建组件（Lobby 相关）
- Modify: 房间内组件（Room 相关）

**Step 1: 创建房间 UI**

- 创建房间表单添加"赖子模式"开关（Tailwind toggle）
- 传递 `wildcard` 参数到 `room:create` 事件

**Step 2: 房间列表显示**

- 房间列表项显示模式标签（如 "赖子" 标签）

**Step 3: 房间内投票 UI**

- 等待中状态显示"切换模式"按钮
- 投票进行中显示投票面板（同意/拒绝）
- 投票结果通知

**Step 4: 提交**

```bash
git add packages/client/src/components/
git commit -m "feat: 房间创建与模式切换 UI"
```

---

## Task 13: 前端 UI - 游戏内赖子显示

**Files:**
- Modify: 手牌渲染组件
- Modify: 游戏信息显示组件

**Step 1: 赖子公告**

- 确定地主后弹出赖子点数公告（如 "本局赖子：7"）
- 短暂显示后自动消失，或保持在游戏信息区

**Step 2: 手牌赖子标记**

- 手牌中赖子牌增加视觉标记（如金色边框、"赖" 角标）
- 使用 Tailwind 类实现，禁止内联 style

**Step 3: CardTracker 赖子信息**

- CardTracker 中赖子牌的行显示特殊标记
- 显示对手剩余赖子数量

**Step 4: 提交**

```bash
git add packages/client/src/components/
git commit -m "feat: 游戏内赖子视觉标记和公告"
```

---

## Task 14: 集成测试与全面回归

**Step 1: 运行全部测试**

```bash
pnpm test -- --run
```

**Step 2: 手动测试关键流程**

- 创建赖子模式房间 → 开始游戏 → 确认赖子公告
- 使用赖子出牌 → 确认牌型识别正确
- 软炸 vs 硬炸 → 确认大小关系
- 纯赖子炸 → 确认优先级
- 含2的顺子 → 确认赖子模式下可出
- 断线重连 → 确认 wildcardRank 同步
- 投票切换模式 → 确认下局生效
- 普通模式游戏 → 确认行为不变

**Step 3: 修复发现的问题**

**Step 4: 最终提交**

```bash
git commit -m "test: 赖子模式集成测试与回归修复"
```
