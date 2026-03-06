# Room And Game State Sync Bugfix Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复房间页/游戏页状态恢复、两次 `pass` 后牌桌显示错误、叫分阶段错误显示 `baseBid`、以及共享契约中的可变常量和长度校验漏洞。

**Architecture:** 通过补充 `room:requestSync` 查询接口，把“房间状态恢复”从偶发广播改成显式拉取；通过给 `game:passed` 增加 round reset 语义，让前端能够准确清空上一墩；通过收紧 shared 类型和运行时保护，避免同步快照和公开规则契约继续泄漏错误状态。

**Tech Stack:** TypeScript, React 19, Zustand, Socket.IO, Vitest, pnpm monorepo

---

### Task 1: 固定 shared 契约回归

**Files:**
- Modify: `packages/shared/src/__tests__/deck.test.ts`
- Modify: `packages/shared/src/__tests__/cardCompare.test.ts`
- Modify: `packages/server/src/__tests__/game.test.ts`

**Step 1: Write the failing tests**

- 在 `packages/shared/src/__tests__/deck.test.ts` 增加：
  - `FULL_DECK` 中单张牌不可变
  - `SEQUENCE_RANKS` 不可变
- 在 `packages/shared/src/__tests__/cardCompare.test.ts` 增加：
  - 顺子/连对/飞机缺失 `length` 时不能比较成功
- 在 `packages/server/src/__tests__/game.test.ts` 增加：
  - 叫分阶段 `getFullState().baseBid` 应为 `0`

**Step 2: Run tests to verify they fail**

Run:
- `pnpm.cmd --filter @blitzlord/shared test`
- `pnpm.cmd --filter @blitzlord/server test`

Expected:
- 新增断言失败，指向可变常量、`canBeat` 长度判断、calling 阶段 `baseBid`

**Step 3: Write minimal implementation**

- 冻结 `FULL_DECK` 的元素对象
- 冻结 `SEQUENCE_RANKS`
- 把 `GameState` / `GameSnapshot` 的 `baseBid` 改成 `0 | 1 | 2 | 3`
- `GameManager` 初始 `baseBid` 改为 `0`
- `canBeat` 对需要长度的牌型强制校验 `length`

**Step 4: Run tests to verify they pass**

Run:
- `pnpm.cmd --filter @blitzlord/shared test`
- `pnpm.cmd --filter @blitzlord/server test`

Expected:
- 两个包测试全绿

### Task 2: 固定房间状态恢复链路

**Files:**
- Modify: `packages/shared/src/types/events.ts`
- Modify: `packages/server/src/socket/handlers.ts`
- Modify: `packages/server/src/__tests__/handlers.test.ts`
- Modify: `packages/client/src/components/Room/RoomView.tsx`
- Modify: `packages/client/src/components/Game/GameBoard.tsx`
- Modify: `packages/client/src/components/Game/ScoreBoard.tsx`
- Modify: `packages/client/src/store/useRoomStore.ts`

**Step 1: Write the failing tests**

- 在 `packages/server/src/__tests__/handlers.test.ts` 增加：
  - `room:requestSync` 在已在房间中时返回当前房间详情
  - 开局后房间回到等待态时，`room:requestSync` 返回重置后的房间详情

**Step 2: Run tests to verify they fail**

Run:
- `pnpm.cmd --filter @blitzlord/server test`

Expected:
- 因缺少 `room:requestSync` 事件或返回结构不匹配而失败

**Step 3: Write minimal implementation**

- 在 shared 事件类型中加入 `room:requestSync`
- 服务端增加 `room:requestSync` handler，返回当前 session 对应房间详情
- `RoomView` 挂载后优先请求 `room:requestSync`；失败时再尝试 `room:join`
- `GameBoard` 挂载时补 `room:requestSync` 恢复，如果房间已回到非 playing 状态则回跳房间页
- `ScoreBoard` 返回房间前清掉旧 `currentRoom`

**Step 4: Run tests to verify they pass**

Run:
- `pnpm.cmd --filter @blitzlord/server test`
- `pnpm.cmd build`

Expected:
- server 测试全绿
- client 构建通过

### Task 3: 修正 `pass` 重置轮次与牌桌显示

**Files:**
- Modify: `packages/shared/src/types/events.ts`
- Modify: `packages/server/src/game/GameManager.ts`
- Modify: `packages/server/src/socket/handlers.ts`
- Modify: `packages/server/src/__tests__/game.test.ts`
- Modify: `packages/server/src/__tests__/handlers.test.ts`
- Modify: `packages/client/src/components/Game/GameBoard.tsx`
- Modify: `packages/client/src/components/Game/PlayedCards.tsx`

**Step 1: Write the failing tests**

- 在 `packages/server/src/__tests__/game.test.ts` 增加：
  - 第二次 `pass` 应返回 `resetRound = true`
- 在 `packages/server/src/__tests__/handlers.test.ts` 增加：
  - 第二次 `pass` 的广播 payload 应包含 `resetRound = true`

**Step 2: Run tests to verify they fail**

Run:
- `pnpm.cmd --filter @blitzlord/server test`

Expected:
- 返回结构中缺少 `resetRound`

**Step 3: Write minimal implementation**

- `GameManager.pass()` 返回 `resetRound`
- `game:passed` 事件增加 `resetRound`
- `GameBoard` 在 `resetRound=true` 时清理 `lastPlay` 和 `lastPassPlayerId`
- `PlayedCards` 保持“有人 pass 时展示上一墩”的现有表现，但 reset 后不再显示旧墩

**Step 4: Run tests to verify they pass**

Run:
- `pnpm.cmd --filter @blitzlord/server test`
- `pnpm.cmd build`

Expected:
- server 测试全绿
- client 构建通过

### Task 4: 固定座位顺序漂移

**Files:**
- Modify: `packages/server/src/room/Room.ts`
- Modify: `packages/server/src/__tests__/room.test.ts`

**Step 1: Write the failing test**

- 在 `packages/server/src/__tests__/room.test.ts` 增加：
  - 有玩家离开后，新玩家补位时，`room.players` / `toRoomDetail().players` 应按 `seatIndex` 排序

**Step 2: Run test to verify it fails**

Run:
- `pnpm.cmd --filter @blitzlord/server test`

Expected:
- 玩家顺序与座位顺序不一致

**Step 3: Write minimal implementation**

- `Room.players` 改成返回按 `seatIndex` 排序的只读视图
- `toRoomDetail()` 也使用排序后的结果

**Step 4: Run test to verify it passes**

Run:
- `pnpm.cmd --filter @blitzlord/server test`

Expected:
- server 测试全绿

### Task 5: 全量验证

**Files:**
- No code changes

**Step 1: Run full verification**

Run:
- `pnpm.cmd --filter @blitzlord/shared test`
- `pnpm.cmd --filter @blitzlord/server test`
- `pnpm.cmd build`

**Step 2: Confirm expected output**

Expected:
- shared tests pass
- server tests pass
- build passes
