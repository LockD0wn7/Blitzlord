# 机器人玩家 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为房间与对局系统增加可手动加入、可自动 ready、可自动叫分与出牌的机器人玩家。

**Architecture:** 在共享类型中引入 `playerType`，把机器人作为正式玩家放入房间与对局快照；服务端新增 `BotController` 和统一的 `MatchCoordinator`，让真人与机器人共用一条对局推进链路；首版机器人策略只复用现有 `getPlayableHints(...)` 与随机合法叫分/出牌，不实现复杂智能。

**Tech Stack:** TypeScript, Vitest, Socket.IO, React, Zustand, pnpm workspace

---

### Task 1: 扩展 shared 玩家类型与事件协议

**Files:**
- Modify: `packages/shared/src/types/room.ts`
- Modify: `packages/shared/src/types/game.ts`
- Modify: `packages/shared/src/types/events.ts`
- Modify: `packages/shared/src/types/index.ts`
- Test: `packages/shared/src/__tests__/botTypes.test.ts`

**Step 1: Write the failing test**

在 `packages/shared/src/__tests__/botTypes.test.ts` 中新增测试，断言：

- `RoomPlayer` 包含 `playerType`
- `GameSnapshot.players[]` 包含 `playerType`
- `ClientEvents` 包含 `room:addBot` 和 `room:removeBot`

```ts
import { describe, expect, it } from "vitest";
import type { RoomPlayer, GameSnapshot, ClientEvents } from "../types/index.js";

describe("bot-related shared types", () => {
  it("exposes playerType on room and game players", () => {
    const roomPlayer: RoomPlayer = {
      playerId: "bot:r1:1",
      playerName: "机器人 1",
      playerType: "bot",
      isReady: true,
      isOnline: true,
      seatIndex: 1,
    };

    const snapshotPlayer: GameSnapshot["players"][number] = {
      playerId: "bot:r1:1",
      playerName: "机器人 1",
      playerType: "bot",
      role: null,
      cardCount: 17,
      isOnline: true,
    };

    expect(roomPlayer.playerType).toBe("bot");
    expect(snapshotPlayer.playerType).toBe("bot");
  });

  it("declares bot room events", () => {
    type AddBot = ClientEvents["room:addBot"];
    type RemoveBot = ClientEvents["room:removeBot"];
    expectTypeOf<AddBot>().toBeFunction();
    expectTypeOf<RemoveBot>().toBeFunction();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:shared -- --run botTypes`

Expected: FAIL，因为 shared 类型和事件尚未包含机器人相关字段。

**Step 3: Write minimal implementation**

先引入最小公共类型：

```ts
export type PlayerType = "human" | "bot";
```

并在房间与快照玩家上增加字段：

```ts
playerType: PlayerType;
```

同时声明事件：

```ts
"room:addBot": (callback: (res: { ok: boolean; error?: string; playerId?: string }) => void) => void;
"room:removeBot": (data: { playerId: string }, callback: (res: { ok: boolean; error?: string }) => void) => void;
```

**Step 4: Run test to verify it passes**

Run: `pnpm test:shared -- --run botTypes`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/shared/src/types packages/shared/src/__tests__/botTypes.test.ts
git commit -m "feat(shared): add bot player types and room events"
```

---

### Task 2: 让房间模型支持机器人席位与真人 ready 规则

**Files:**
- Modify: `packages/server/src/room/Room.ts`
- Modify: `packages/server/src/room/RoomManager.ts`
- Test: `packages/server/src/__tests__/room.test.ts`

**Step 1: Write the failing test**

在 `packages/server/src/__tests__/room.test.ts` 中新增测试，断言：

- 机器人可以被加入并占用座位
- 机器人默认 `isReady = true`
- `allReady` 只要求所有真人 ready
- 可以按 `playerId` 移除机器人

```ts
it("treats bots as ready by default", () => {
  room.addPlayer("p1", "Alice", "human");
  room.addPlayer("bot:r1:1", "机器人 1", "bot");
  room.addPlayer("bot:r1:2", "机器人 2", "bot");

  room.setReady("p1", true);

  expect(room.allReady).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @blitzlord/server test -- --run room`

Expected: FAIL，因为 `RoomPlayer` 还没有玩家类型，`allReady` 也仍按所有玩家判断。

**Step 3: Write minimal implementation**

把 `Room.addPlayer(...)` 扩展为支持玩家类型：

```ts
addPlayer(playerId: string, playerName: string, playerType: PlayerType = "human"): number | null
```

机器人写入时默认：

```ts
isReady: playerType === "bot",
isOnline: true,
playerType,
```

并调整 `allReady`：

```ts
get allReady(): boolean {
  return this.isFull && this._players.every((player) => player.playerType === "bot" || player.isReady);
}
```

在 `RoomManager` 中新增：

```ts
addBot(roomId: string, botId: string, botName: string)
removeBot(roomId: string, playerId: string)
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @blitzlord/server test -- --run room`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/room packages/server/src/__tests__/room.test.ts
git commit -m "feat(server): support bot players in room model"
```

---

### Task 3: 为对局玩家与快照同步补齐 `playerType`

**Files:**
- Modify: `packages/server/src/platform/types.ts`
- Modify: `packages/server/src/games/doudizhu/DoudizhuMatchRuntime.ts`
- Test: `packages/server/src/__tests__/game.test.ts`

**Step 1: Write the failing test**

在 `packages/server/src/__tests__/game.test.ts` 中新增测试，断言对局快照保留机器人类型：

```ts
expect(snapshot.players).toContainEqual(
  expect.objectContaining({
    playerId: "bot:r1:1",
    playerType: "bot",
  }),
);
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @blitzlord/server test -- --run game`

Expected: FAIL，因为 `MatchPlayer` 和 `GameSnapshot.players` 尚未传递 `playerType`。

**Step 3: Write minimal implementation**

修改 `MatchPlayer`：

```ts
export interface MatchPlayer {
  playerId: string;
  playerName: string;
  playerType: PlayerType;
}
```

在 `DoudizhuMatchRuntime` 初始化和 `getFullState(...)` 中透传：

```ts
playerType: p.playerType,
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @blitzlord/server test -- --run game`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/platform/types.ts packages/server/src/games/doudizhu/DoudizhuMatchRuntime.ts packages/server/src/__tests__/game.test.ts
git commit -m "feat(server): propagate bot player type into match snapshots"
```

---

### Task 4: 抽出统一的对局动作协调器

**Files:**
- Create: `packages/server/src/match/MatchCoordinator.ts`
- Modify: `packages/server/src/socket/handlers.ts`
- Test: `packages/server/src/__tests__/handlers.test.ts`

**Step 1: Write the failing test**

先在 `handlers.test.ts` 里增加一个围绕统一动作链的断言，验证真人动作后仍能同步状态并结束对局，不依赖旧的 handler 内联逻辑。

```ts
expect(actionResult.ok).toBe(true);
expect(nextSnapshot.phase).toBe(GamePhase.Playing);
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @blitzlord/server test -- --run handlers`

Expected: FAIL 或需要大量重复改动，因为目前所有 dispatch/sync/end 逻辑都内嵌在 `handlers.ts`。

**Step 3: Write minimal implementation**

抽一个最小协调器：

```ts
export interface MatchCoordinatorDeps {
  io: TypedServer;
  roomManager: RoomManager;
  sessionManager: SessionManager;
  matches: Map<string, MatchEngine>;
}

export class MatchCoordinator {
  handleAction(roomId: string, result: MatchActionResult): void { /* sync/end/listUpdated */ }
  emitMatchSync(roomId: string): void { /* emit snapshot for each player */ }
}
```

先让真人动作改为走 `MatchCoordinator`，行为保持不变。

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @blitzlord/server test -- --run handlers`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/match/MatchCoordinator.ts packages/server/src/socket/handlers.ts packages/server/src/__tests__/handlers.test.ts
git commit -m "refactor(server): centralize match action coordination"
```

---

### Task 5: 新增 BotController 和最低智能策略

**Files:**
- Create: `packages/server/src/bot/types.ts`
- Create: `packages/server/src/bot/strategy.ts`
- Create: `packages/server/src/bot/BotController.ts`
- Test: `packages/server/src/__tests__/botController.test.ts`

**Step 1: Write the failing test**

新增 `packages/server/src/__tests__/botController.test.ts`，断言：

- 轮到机器人叫分时会在定时后提交合法随机叫分
- 轮到机器人出牌时有 hint 就随机出一组，无 hint 就 pass
- 同一房间重复调度只会保留一个 timer

```ts
it("plays a legal random hint when it is the bot turn", async () => {
  const action = decideBotAction({
    phase: GamePhase.Playing,
    playerId: "bot:r1:1",
    hand,
    previousPlay,
    wildcardRank: null,
  });

  expect(action.type === "playCards" || action.type === "pass").toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @blitzlord/server test -- --run botController`

Expected: FAIL，因为 `BotController` 和策略文件尚不存在。

**Step 3: Write minimal implementation**

策略函数只做最低智能：

```ts
export function decideBotBid(currentMaxBid: 0 | 1 | 2 | 3): 0 | 1 | 2 | 3 {
  const options = {
    0: [0, 1, 2, 3],
    1: [0, 2, 3],
    2: [0, 3],
    3: [0],
  } as const;
  return sample(options[currentMaxBid]);
}

export function decideBotPlay(...) {
  const hints = getPlayableHints(hand, previousPlay, wildcardRank);
  if (hints.length === 0) return { type: "pass" } as const;
  return { type: "playCards", cards: sample(hints).cards } as const;
}
```

`BotController` 负责：

- 为房间创建单个 timer
- 定时后检查当前仍轮到机器人
- 调用 `MatchEngine.dispatch(...)`
- 再交给 `MatchCoordinator` 做同步和结算

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @blitzlord/server test -- --run botController`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/bot packages/server/src/__tests__/botController.test.ts
git commit -m "feat(server): add bot controller and random legal strategy"
```

---

### Task 6: 接入 `room:addBot` / `room:removeBot` 与机器人调度

**Files:**
- Modify: `packages/server/src/socket/handlers.ts`
- Modify: `packages/server/src/__tests__/handlers.test.ts`

**Step 1: Write the failing test**

在 `handlers.test.ts` 中新增测试，断言：

- 真人可以在等待阶段添加机器人
- 机器人会出现在 `room:updated`
- 真人可以移除机器人
- 1 真人 + 2 机器人 + 真人 ready 后可开局

```ts
const addResult = await emitRaw<{ ok: boolean; playerId?: string }>(c1, "room:addBot");
expect(addResult.ok).toBe(true);

const updatedRoom = await waitForEvent<RoomDetail>(c1, "room:updated");
expect(updatedRoom.players.some((player) => player.playerType === "bot")).toBe(true);
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @blitzlord/server test -- --run handlers`

Expected: FAIL，因为 socket 层还没有机器人事件与权限控制。

**Step 3: Write minimal implementation**

在 `handlers.ts` 中：

- 注入 `BotController`
- 新增 `room:addBot`
- 新增 `room:removeBot`
- 开局成功后调用 `botController.scheduleIfNeeded(roomId)`
- 真人每次 action 后也触发 `scheduleIfNeeded(roomId)`

并确保只有等待阶段允许加减机器人。

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @blitzlord/server test -- --run handlers`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/socket/handlers.ts packages/server/src/__tests__/handlers.test.ts
git commit -m "feat(server): wire bot room events and scheduling"
```

---

### Task 7: 前端房间页与对局页展示机器人

**Files:**
- Modify: `packages/client/src/games/doudizhu/store/useDoudizhuGameStore.ts`
- Modify: `packages/client/src/components/Room/RoomView.tsx`
- Modify: `packages/client/src/components/Game/GameBoard.tsx`
- Modify: `packages/client/src/components/Game/OpponentArea.tsx`
- Modify: `packages/client/src/components/Game/PlayedCards.tsx`
- Modify: `packages/client/src/components/Game/CardTrackerPanel.tsx`
- Modify: `packages/client/src/components/Game/ScoreBoard.tsx`
- Test: `packages/client/src/components/Game/__tests__/botLabels.test.tsx`

**Step 1: Write the failing test**

新增 `packages/client/src/components/Game/__tests__/botLabels.test.tsx`，断言：

- 机器人在房间页显示“机器人”标签
- 对手区显示机器人标签
- 记牌器或出牌记录能区分机器人名字

```tsx
expect(html).toContain("机器人");
expect(html).toContain("机器人 1");
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @blitzlord/client test -- --run botLabels`

Expected: FAIL，因为前端 store 和组件还没有 `playerType`。

**Step 3: Write minimal implementation**

在 store 中保留 `playerType`，并在 UI 中统一展示：

```tsx
{player.playerType === "bot" && (
  <span className="...">机器人</span>
)}
```

房间页新增两个按钮：

```tsx
<button onClick={handleAddBot}>添加机器人</button>
<button onClick={() => handleRemoveBot(player.playerId)}>移除机器人</button>
```

只在等待阶段显示。

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @blitzlord/client test -- --run botLabels`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/client/src/games/doudizhu/store packages/client/src/components/Room packages/client/src/components/Game packages/client/src/components/Game/__tests__/botLabels.test.tsx
git commit -m "feat(client): show bot players in room and match views"
```

---

### Task 8: 补端到端验证并清理边界

**Files:**
- Modify: `packages/server/src/__tests__/handlers.test.ts`
- Modify: `docs/plans/2026-03-12-robot-player-design.md`

**Step 1: Write the failing test**

在 `handlers.test.ts` 增补一个完整流程测试：

- 1 个真人建房
- 连续添加 2 个机器人
- 真人 ready
- 等待开局
- 观察机器人至少执行一次叫分和一次出牌/过牌

```ts
expect(snapshot.players.filter((player) => player.playerType === "bot")).toHaveLength(2);
expect(snapshot.phase === GamePhase.Calling || snapshot.phase === GamePhase.Playing).toBe(true);
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @blitzlord/server test -- --run handlers`

Expected: 如果机器人调度链仍有遗漏，这里会失败或超时。

**Step 3: Write minimal fixes**

只修复端到端测试暴露的问题：

- 清理过期 timer
- 对局结束时取消调度
- 房间销毁时取消调度
- 真人离房导致房间重置时取消调度

同时回填设计文档中的实际落地差异。

**Step 4: Run final verification**

Run:

- `pnpm test:shared`
- `pnpm --filter @blitzlord/server test`
- `pnpm --filter @blitzlord/client test`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/__tests__/handlers.test.ts docs/plans/2026-03-12-robot-player-design.md
git commit -m "test: verify full robot player flow"
```
