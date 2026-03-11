# 平台化重构 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将当前仓库重构为以 `gameId + modeId` 驱动的平台化架构，并让斗地主标准模式与斗地主赖子模式运行在统一平台内核上。

**Architecture:** 保留现有 monorepo 与 Socket.IO 通信层，引入平台注册表、规则集接口和通用 MatchEngine。把斗地主相关类型、规则、视图、模式配置全部下沉到 `games/doudizhu` 命名空间，通过平台注册与装载运行，删除旧的 `wildcard: boolean` 和 `wildcardRank` 平台字段。

**Tech Stack:** TypeScript, Vitest, Socket.IO, React, Zustand, pnpm workspace

---

### Task 1: 建立 shared 平台核心类型与注册表

**Files:**
- Create: `packages/shared/src/platform/gameDefinition.ts`
- Create: `packages/shared/src/platform/modeDefinition.ts`
- Create: `packages/shared/src/platform/ruleSet.ts`
- Create: `packages/shared/src/platform/matchTypes.ts`
- Create: `packages/shared/src/platform/registry.ts`
- Create: `packages/shared/src/platform/index.ts`
- Create: `packages/shared/src/__tests__/platformRegistry.test.ts`
- Modify: `packages/shared/src/index.ts`

**Step 1: Write the failing test**

在 `packages/shared/src/__tests__/platformRegistry.test.ts` 中编写测试，断言：

- 可注册一个 `GameDefinition`
- 可通过 `gameId + modeId` 取回模式定义
- 找不到定义时返回 `null` 或抛出预期错误

**Step 2: Run test to verify it fails**

Run: `pnpm test:shared -- --run platformRegistry`

Expected: FAIL，因为平台注册表文件和导出尚不存在。

**Step 3: Write minimal implementation**

定义最小平台接口：

```ts
export interface GameDefinition<TConfig = unknown> {
  gameId: string;
  gameName: string;
  modes: readonly ModeDefinition<TConfig>[];
}

export interface ModeDefinition<TConfig = unknown> {
  modeId: string;
  modeName: string;
  defaultConfig: TConfig;
}
```

实现注册表的 `registerGame`、`getGameDefinition`、`getModeDefinition`。

**Step 4: Run test to verify it passes**

Run: `pnpm test:shared -- --run platformRegistry`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/shared/src/platform packages/shared/src/__tests__/platformRegistry.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): add platform registry primitives"
```

---

### Task 2: 建立斗地主命名空间并迁移 shared 类型边界

**Files:**
- Create: `packages/shared/src/games/doudizhu/types.ts`
- Create: `packages/shared/src/games/doudizhu/index.ts`
- Create: `packages/shared/src/__tests__/doudizhuTypes.test.ts`
- Modify: `packages/shared/src/types/card.ts`
- Modify: `packages/shared/src/types/game.ts`
- Modify: `packages/shared/src/types/room.ts`
- Modify: `packages/shared/src/types/events.ts`

**Step 1: Write the failing test**

在 `packages/shared/src/__tests__/doudizhuTypes.test.ts` 中编写测试，断言：

- 平台房间类型包含 `gameId`、`modeId`
- 平台快照类型不再要求 `wildcardRank`
- 斗地主命名空间中仍有 `Doudizhu*` 专属类型

**Step 2: Run test to verify it fails**

Run: `pnpm test:shared -- --run doudizhuTypes`

Expected: FAIL，因为当前根类型仍直接暴露斗地主私有字段。

**Step 3: Write minimal implementation**

- 在 `games/doudizhu/types.ts` 中定义 `DoudizhuCard`、`DoudizhuPlayMeta`、`DoudizhuModeConfig`、`DoudizhuSnapshot`
- 将房间类型改为：

```ts
interface RoomInfo {
  roomId: string;
  roomName: string;
  gameId: string;
  gameName: string;
  modeId: string;
  modeName: string;
}
```

- 从平台根类型中移除 `wildcard`、`wildcardRank`

**Step 4: Run test to verify it passes**

Run: `pnpm test:shared -- --run doudizhuTypes`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/shared/src/games/doudizhu packages/shared/src/types packages/shared/src/__tests__/doudizhuTypes.test.ts
git commit -m "refactor(shared): separate platform and doudizhu types"
```

---

### Task 3: 迁移斗地主规则到 `games/doudizhu`

**Files:**
- Create: `packages/shared/src/games/doudizhu/rules/common/*.ts`
- Create: `packages/shared/src/games/doudizhu/rules/classic/*.ts`
- Create: `packages/shared/src/games/doudizhu/rules/wildcard/*.ts`
- Create: `packages/shared/src/games/doudizhu/modes/classic.ts`
- Create: `packages/shared/src/games/doudizhu/modes/wildcard.ts`
- Create: `packages/shared/src/games/doudizhu/definition.ts`
- Modify: `packages/shared/src/__tests__/cardType.test.ts`
- Modify: `packages/shared/src/__tests__/hint.test.ts`
- Modify: `packages/shared/src/__tests__/validator.test.ts`
- Modify: `packages/shared/src/__tests__/wildcardCardType.test.ts`
- Modify: `packages/shared/src/__tests__/wildcardHint.test.ts`
- Modify: `packages/shared/src/__tests__/wildcardValidator.test.ts`
- Modify: `packages/shared/src/__tests__/wildcardCompare.test.ts`
- Modify: `packages/shared/src/rules/index.ts`

**Step 1: Write the failing test**

先修改现有 shared 测试导入路径，让它们从 `games/doudizhu` 命名空间读取规则实现。

**Step 2: Run test to verify it fails**

Run: `pnpm test:shared -- --run cardType`

Expected: FAIL，因为新路径和新实现尚不存在。

**Step 3: Write minimal implementation**

- 先复制现有斗地主规则实现到 `games/doudizhu/rules/common`
- 将 classic / wildcard 的差异封装为两个 `RuleSet`
- `definition.ts` 注册两个模式：

```ts
export const doudizhuDefinition = {
  gameId: "doudizhu",
  gameName: "斗地主",
  modes: [classicMode, wildcardMode],
};
```

**Step 4: Run test to verify it passes**

Run:

- `pnpm test:shared -- --run cardType`
- `pnpm test:shared -- --run wildcardCardType`
- `pnpm test:shared -- --run wildcardHint`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/shared/src/games/doudizhu packages/shared/src/__tests__ packages/shared/src/rules/index.ts
git commit -m "refactor(shared): move doudizhu rules into game namespace"
```

---

### Task 4: 重构 server 房间模型为 `gameId + modeId + config`

**Files:**
- Modify: `packages/server/src/room/Room.ts`
- Modify: `packages/server/src/room/RoomManager.ts`
- Modify: `packages/server/src/__tests__/room.test.ts`

**Step 1: Write the failing test**

在 `packages/server/src/__tests__/room.test.ts` 中新增或修改测试，断言：

- 创建房间时必须记录 `gameId`、`modeId`
- 投票变更不再使用 `wildcard`，而是 `modeId` 或 `configPatch`
- `toRoomInfo` / `toRoomDetail` 返回平台化字段

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @blitzlord/server test -- --run room`

Expected: FAIL，因为 Room 仍以 `wildcard` 布尔值建模。

**Step 3: Write minimal implementation**

将 `Room` 改为持有：

```ts
type RoomGameSelection = {
  gameId: string;
  modeId: string;
  config: Record<string, unknown>;
};
```

将模式投票重构为 `startConfigVote` / `castConfigVote`。

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @blitzlord/server test -- --run room`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/room packages/server/src/__tests__/room.test.ts
git commit -m "refactor(server): platformize room game selection"
```

---

### Task 5: 引入服务端平台注册表与 MatchEngine

**Files:**
- Create: `packages/server/src/platform/GameRegistry.ts`
- Create: `packages/server/src/platform/MatchEngine.ts`
- Create: `packages/server/src/platform/actionHandlers.ts`
- Create: `packages/server/src/__tests__/matchEngine.test.ts`
- Modify: `packages/server/src/game/GameManager.ts`
- Modify: `packages/server/src/__tests__/game.test.ts`

**Step 1: Write the failing test**

新增 `packages/server/src/__tests__/matchEngine.test.ts`，断言：

- 可根据房间选择创建斗地主 classic 对局
- 可根据房间选择创建斗地主 wildcard 对局
- `match:action` 可分发到对应 handler

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @blitzlord/server test -- --run matchEngine`

Expected: FAIL，因为 `MatchEngine` 与注册表尚不存在。

**Step 3: Write minimal implementation**

- 将 `GameManager` 的通用流程抽离到 `MatchEngine`
- 保留斗地主对局状态机，但通过 `GameRegistry` 和 `RuleSet` 创建
- 让 classic / wildcard 由 mode 定义驱动，不再由布尔字段驱动

**Step 4: Run test to verify it passes**

Run:

- `pnpm --filter @blitzlord/server test -- --run matchEngine`
- `pnpm --filter @blitzlord/server test -- --run game`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/platform packages/server/src/game/GameManager.ts packages/server/src/__tests__/matchEngine.test.ts packages/server/src/__tests__/game.test.ts
git commit -m "refactor(server): add platform match engine"
```

---

### Task 6: 重构 Socket 协议为平台房间和统一动作入口

**Files:**
- Modify: `packages/shared/src/types/events.ts`
- Modify: `packages/server/src/socket/handlers.ts`
- Modify: `packages/server/src/__tests__/handlers.test.ts`
- Modify: `packages/client/src/socket/index.ts`
- Modify: `packages/client/src/socket/index.test.ts`

**Step 1: Write the failing test**

修改 `handlers.test.ts` 与 `socket/index.test.ts`，断言：

- `room:create` 发送 `gameId + modeId`
- 服务端发出 `match:started` / `match:syncState`
- 客户端通过 `match:action` 发送 `callBid` / `playCards` / `pass`

**Step 2: Run test to verify it fails**

Run:

- `pnpm --filter @blitzlord/server test -- --run handlers`
- `pnpm --filter @blitzlord/client test -- --run socket`

Expected: FAIL，因为旧协议仍基于 `wildcard` 和专用事件。

**Step 3: Write minimal implementation**

定义新协议：

```ts
"room:create": (data: { roomName: string; gameId: string; modeId: string; config?: Record<string, unknown> }, cb) => void;
"match:action": (data: { type: string; payload?: unknown }, cb) => void;
```

将服务端 handlers 全部切换到平台协议。

**Step 4: Run test to verify it passes**

Run:

- `pnpm --filter @blitzlord/server test -- --run handlers`
- `pnpm --filter @blitzlord/client test -- --run socket`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/shared/src/types/events.ts packages/server/src/socket/handlers.ts packages/server/src/__tests__/handlers.test.ts packages/client/src/socket
git commit -m "refactor(protocol): switch to platform room and match actions"
```

---

### Task 7: 平台化 client store 与房间/大厅展示

**Files:**
- Modify: `packages/client/src/store/useRoomStore.ts`
- Modify: `packages/client/src/store/useGameStore.ts`
- Modify: `packages/client/src/components/Lobby/CreateRoom.tsx`
- Modify: `packages/client/src/components/Lobby/Lobby.tsx`
- Modify: `packages/client/src/components/Lobby/RoomList.tsx`
- Modify: `packages/client/src/components/Room/RoomView.tsx`
- Create: `packages/client/src/__tests__/platformRoomFlow.test.tsx`

**Step 1: Write the failing test**

在 `packages/client/src/__tests__/platformRoomFlow.test.tsx` 中断言：

- 创建房间表单能选择 `gameId` 与 `modeId`
- 房间页展示 `gameName` 与 `modeName`
- 模式投票展示不再使用 `wildcard` 文案判断

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @blitzlord/client test -- --run platformRoomFlow`

Expected: FAIL，因为前端 store 和 UI 仍然耦合 `wildcard`。

**Step 3: Write minimal implementation**

- 把 room store 改为保存 `gameId`、`modeId`、`configVote`
- 在创建房间 UI 中固定接入斗地主两个模式选项
- 用平台注册信息展示游戏名和模式名

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @blitzlord/client test -- --run platformRoomFlow`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/client/src/store packages/client/src/components/Lobby packages/client/src/components/Room packages/client/src/__tests__/platformRoomFlow.test.tsx
git commit -m "refactor(client): platformize lobby and room state"
```

---

### Task 8: 平台化对局页面装载与斗地主 UI 接入

**Files:**
- Create: `packages/client/src/platform/gameRegistry.ts`
- Create: `packages/client/src/platform/GameShell.tsx`
- Create: `packages/client/src/games/doudizhu/DoudizhuMatchView.tsx`
- Modify: `packages/client/src/components/Game/GameBoard.tsx`
- Modify: `packages/client/src/components/Game/ActionBar.tsx`
- Modify: `packages/client/src/components/Game/PlayerHand.tsx`
- Modify: `packages/client/src/components/Game/PlayedCards.tsx`
- Modify: `packages/client/src/routes/index.tsx`
- Create: `packages/client/src/components/Game/__tests__/gameShell.test.tsx`

**Step 1: Write the failing test**

在 `packages/client/src/components/Game/__tests__/gameShell.test.tsx` 中断言：

- `GameShell` 根据房间/快照中的 `gameId` 装载斗地主对局视图
- 斗地主 classic 与 wildcard 都能复用同一个游戏入口

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @blitzlord/client test -- --run gameShell`

Expected: FAIL，因为当前路由与页面直接绑定斗地主组件。

**Step 3: Write minimal implementation**

- 建立前端游戏注册表
- 将现有 `GameBoard` 收敛为斗地主对局实现
- 路由改为先经过 `GameShell`

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @blitzlord/client test -- --run gameShell`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/client/src/platform packages/client/src/games/doudizhu packages/client/src/components/Game packages/client/src/routes/index.tsx
git commit -m "refactor(client): load matches through game registry"
```

---

### Task 9: 删除旧字段与旧分支，收口平台边界

**Files:**
- Modify: `packages/shared/src/**`
- Modify: `packages/server/src/**`
- Modify: `packages/client/src/**`

**Step 1: Write the failing test**

新增或修改断言，确保全仓不再依赖旧字段：

- `wildcard: boolean` 不再存在于平台 room 类型
- `wildcardRank` 不再存在于平台 snapshot 类型
- 旧 `room:voteMode` / `game:playCards` 等协议不再导出

**Step 2: Run test to verify it fails**

Run:

- `pnpm test:shared`
- `pnpm --filter @blitzlord/server test`
- `pnpm --filter @blitzlord/client test`

Expected: FAIL，直到旧引用全部清理完毕。

**Step 3: Write minimal implementation**

移除旧类型、旧事件、旧 helper、旧 UI 条件分支；保留斗地主赖子能力，但只存在于 `games/doudizhu` 命名空间。

**Step 4: Run test to verify it passes**

Run:

- `pnpm test:shared`
- `pnpm --filter @blitzlord/server test`
- `pnpm --filter @blitzlord/client test`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/shared packages/server packages/client
git commit -m "refactor: remove legacy wildcard-centric platform model"
```

---

### Task 10: 全量验证与文档补充

**Files:**
- Modify: `README.md`
- Modify: `docs/plans/2026-03-11-platformization-design.md`

**Step 1: Write the failing check**

列出必须完成的验证清单：

- 共享规则测试通过
- 服务端集成测试通过
- 客户端测试通过
- 本地构建通过

**Step 2: Run verification to expose remaining failures**

Run:

- `pnpm test`
- `pnpm build`

Expected: 若仍有平台边界漏改、导出遗漏或类型错误，这一步会失败。

**Step 3: Write minimal fixes**

仅修复验证暴露的问题，并在 `README.md` 中补充平台化后的术语与目录说明。

**Step 4: Run final verification**

Run:

- `pnpm test`
- `pnpm build`

Expected: PASS

**Step 5: Commit**

```bash
git add README.md docs/plans/2026-03-11-platformization-design.md
git commit -m "docs: document platformized architecture"
```
