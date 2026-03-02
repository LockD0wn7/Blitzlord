# Blitzlord 斗地主 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> **版本：** v2（审核修订版）

**Goal:** 多人在线斗地主 Web 应用，含房间系统、断线重连、标准叫分、计分系统。

**Tech Stack:** React, TypeScript, Vite, Tailwind CSS, React Router, Zustand, Node.js, Socket.IO, pnpm workspace, Vitest

**Design Doc:** `docs/plans/2026-03-02-doudizhu-design.md`

---

## Task 1: Monorepo 脚手架

**产出：** 项目骨架可运行，三个包能互相引用。

**Files:**
- `package.json` — workspace 根配置
- `pnpm-workspace.yaml` — `packages/*`
- `tsconfig.base.json` — 共享 TS 配置
- `.gitignore`
- `packages/shared/package.json` + `tsconfig.json` + `src/index.ts`
- `packages/server/package.json` + `tsconfig.json` + `src/index.ts`（最小 Socket.IO 服务器）
- `packages/client/` — Vite + React + Tailwind + React Router 脚手架

**关键点：**
- client 依赖：react, react-dom, react-router-dom, zustand, socket.io-client, tailwindcss, @tailwindcss/vite
- server 依赖：socket.io, tsx, @blitzlord/shared
- shared 依赖：vitest (dev)
- Tailwind 4 配置：vite plugin + CSS `@import "tailwindcss"`

**验证：** `pnpm install && pnpm dev:server && pnpm dev:client` 均可启动。

**提交：** `feat: initialize monorepo with shared, server, and client packages`

---

## Task 2: 共享类型和常量

**产出：** 所有 TypeScript 类型定义，供前后端共用。

**Files:**
- `packages/shared/src/types/card.ts` — Card, Suit, Rank, CardType, CardPlay
- `packages/shared/src/types/game.ts` — GamePhase, PlayerRole, PlayerState, GameState, ScoreDetail
- `packages/shared/src/types/room.ts` — RoomStatus, RoomInfo, RoomDetail
- `packages/shared/src/types/events.ts` — ClientEvents, ServerEvents（Socket.IO 类型化事件）
- `packages/shared/src/constants/card.ts` — FULL_DECK, RANK_NAMES, SUIT_SYMBOLS, 各种长度常量
- 各 `index.ts` 导出

**关键变更（vs v1）：**
- `game:callLandlord` 事件参数改为 `{ bid: 0 | 1 | 2 | 3 }`（0=不叫）
- 新增 `game:callUpdate` 服务端事件（叫分进展广播）
- 新增 `game:syncState` / `game:requestSync` 事件（`GameSnapshot` 类型）
- 新增 `GameSnapshot` 类型（玩家视角的完整状态快照，自己手牌 + 他人牌数）
- 新增 `player:disconnected` / `player:reconnected` 事件
- 新增 `ScoreDetail` 类型（baseBid, bombCount, isSpring, finalScore）

**提交：** `feat(shared): add types and constants for v2 design`

---

## Task 3: 共享工具函数 + 测试

**产出：** deck、sort、cardEquals 工具。

**Files:**
- `packages/shared/src/utils/deck.ts` — createDeck, shuffleDeck, dealCards
- `packages/shared/src/utils/sort.ts` — sortCards
- `packages/shared/src/utils/cardEquals.ts` — cardEquals(a, b)（统一替代所有 `rank === && suit ===`）
- `packages/shared/src/__tests__/deck.test.ts`
- `packages/shared/src/__tests__/sort.test.ts`
- `packages/shared/src/__tests__/cardEquals.test.ts`

**提交：** `feat(shared): add deck, sort, cardEquals utilities with tests`

---

## Task 4: 牌型识别 + 测试

**产出：** identifyCardType 函数，覆盖全部 14 种牌型。

**Files:**
- `packages/shared/src/rules/cardType.ts`
- `packages/shared/src/__tests__/cardType.test.ts`

**关键算法：**
1. 统计每个 rank 的出现次数 → `Map<Rank, count>`
2. 按 count 分组 → quads[], triples[], pairs[], singles[]
3. 判定顺序：火箭 → 单张 → 对子 → 炸弹 → **四带二系列（优先于飞机）** → 三张系列 → 顺子 → 连对 → 飞机系列
4. 四带二歧义：8 张牌先检查是否有 4 张相同，有则优先四带两对；无则检查飞机

**测试覆盖：** 每种牌型至少 1 个正例，无效组合返回 null，**四带二 vs 飞机歧义用例**。

**提交：** `feat(shared): add card type identification with ambiguity handling`

---

## Task 5: 牌型比较 + 测试

**Files:**
- `packages/shared/src/rules/cardCompare.ts` — canBeat(current, previous)
- `packages/shared/src/__tests__/cardCompare.test.ts`

**逻辑：** 火箭 > 炸弹 > 同类型且 mainRank 更大（顺子/连对/飞机需长度相同）。

**提交：** `feat(shared): add card comparison logic`

---

## Task 6: 出牌验证 + 测试

**Files:**
- `packages/shared/src/rules/validator.ts` — validatePlay(cards, hand, previousPlay)
- `packages/shared/src/__tests__/validator.test.ts`

**逻辑：** 用 cardEquals 检查手牌包含 → identifyCardType → canBeat。

**提交：** `feat(shared): add play validation`

---

## Task 7: 计分系统 + 测试

**产出：** 倍率计算和结算逻辑。

**Files:**
- `packages/shared/src/rules/scoring.ts`
- `packages/shared/src/__tests__/scoring.test.ts`

**核心函数：**
```typescript
function calculateScore(params: {
  baseBid: 1 | 2 | 3;
  bombCount: number;
  rocketUsed: boolean;
  isSpring: boolean;
}): number
// 返回 baseBid × 2^bombCount × (rocketUsed ? 2 : 1) × (isSpring ? 2 : 1)

function isSpring(landlordPlayCount: number, peasantsPlayCount: [number, number]): boolean
// 地主春天：两个农民 playCount 都为 0
// 反春天：地主只出过 1 手牌
```

**提交：** `feat(shared): add scoring system with spring detection`

---

## Task 8: 服务端会话管理 + 测试

**产出：** token 身份映射，断线/重连管理。

**Files:**
- `packages/server/src/session/SessionManager.ts`
- `packages/server/src/__tests__/session.test.ts`

**核心 API：**
```typescript
class SessionManager {
  register(token: string, socketId: string, playerName: string): PlayerSession
  getByToken(token: string): PlayerSession | undefined
  getBySocketId(socketId: string): PlayerSession | undefined
  disconnect(socketId: string): PlayerSession | undefined  // 标记断线时间
  reconnect(token: string, newSocketId: string): PlayerSession | undefined
  getDisconnectedSessions(): PlayerSession[]  // 用于超时检查
}
```

**提交：** `feat(server): add SessionManager for token-based identity`

---

## Task 9: 服务端房间管理 + 测试

**产出：** Room 封装 + RoomManager。

**Files:**
- `packages/server/src/room/Room.ts`
- `packages/server/src/room/RoomManager.ts`
- `packages/server/src/__tests__/room.test.ts`

**Room 封装方法（修复审核 #7）：**
- `startPlaying()` / `finishGame()` / `resetReady()` / `backToWaiting()`
- 外部不直接修改 `room.status` 或 `room.players[i].isReady`

**RoomManager：** 使用 playerId（token）而非 socket.id 作为键。

**提交：** `feat(server): add Room with encapsulated state transitions`

---

## Task 10: 服务端游戏状态机 + 测试

**产出：** 完整游戏流程，含叫分制、春天、计分、断线超时。

**Files:**
- `packages/server/src/game/GameManager.ts`
- `packages/server/src/__tests__/game.test.ts`

**vs v1 变更：**
- 叫分改为 `callBid(playerId, bid: 0|1|2|3)` — 0=不叫，3=封顶直接确定，每人仅一次机会
- 记录 `bombCount`、`rocketUsed`、每个玩家的出牌次数（用于春天判定）
- 重发牌计数器，3 次上限
- `getFullState(playerId)` — 返回该玩家视角的完整状态快照（用于 syncState）
- `handleDisconnectTimeout(playerId)` — 超时判负

**提交：** `feat(server): add GameManager with bidding, spring, and scoring`

---

## Task 11: 服务端 Socket handlers + 集成测试

**产出：** 工厂函数模式的事件处理 + 真实 Socket.IO 集成测试。

**Files:**
- `packages/server/src/socket/handlers.ts`
- `packages/server/src/__tests__/handlers.test.ts`

**关键设计（修复审核 #3）：**
```typescript
export function createHandlers(deps: {
  io: TypedServer;
  roomManager: RoomManager;
  sessionManager: SessionManager;
  games: Map<string, GameManager>;
}): (socket: TypedSocket) => void
```

**重连流程：**
1. `connection` 时读取 `socket.handshake.auth.token`
2. SessionManager 查找已有 session → 恢复 → 重新加入 Socket.IO room → 推送 `game:syncState`
3. 无已有 session → 注册新 session

**断线超时：** `disconnect` 时启动 60 秒定时器，超时调用 `game.handleDisconnectTimeout()`。

**主动离开：** `room:leave` 在游戏中 = 立即判负（不走 60 秒等待）。

**集成测试（修复审核 #9）：**
- 用真实 `socket.io` server + `socket.io-client` 连接
- 测试流程：创建房间 → 加入 → 准备 → 叫分 → 出牌 → 结束
- 测试重连：disconnect → 新 socket 带相同 token → 收到 syncState

**提交：** `feat(server): add socket handlers with DI and integration tests`

---

## Task 12: 服务端入口

**Files:**
- `packages/server/src/index.ts`

**组装依赖，启动服务器。** 创建 RoomManager、SessionManager、games Map，传入 createHandlers。

**提交：** `feat(server): wire up server entry with dependency injection`

---

## Task 13: 前端 Socket 客户端

**Files:**
- `packages/client/src/socket/index.ts`

**关键点：** 连接时从 `localStorage` 读取/生成 token，通过 `auth: { token }` 传递。

**提交：** `feat(client): add Socket.IO client with token auth`

---

## Task 14: 前端 Zustand stores

**Files:**
- `packages/client/src/store/useSocketStore.ts` — 连接状态、token、playerName（localStorage 持久化）
- `packages/client/src/store/useRoomStore.ts` — 房间列表、当前房间
- `packages/client/src/store/useGameStore.ts` — 游戏状态，用 cardEquals 处理手牌过滤

**关键点：**
- playerName 读写 localStorage（修复审核 #14）
- `game:syncState` 监听：用快照完整覆盖本地状态（修复审核 #4）
- 手牌过滤用 `cardEquals`（修复审核 #11）

**提交：** `feat(client): add Zustand stores with localStorage and syncState`

---

## Task 15: 前端路由

**Files:**
- `packages/client/src/routes/index.tsx` — React Router hash mode 路由配置
- `packages/client/src/App.tsx` — HashRouter 包裹

**路由：** `#/` → 登录, `#/lobby` → 大厅, `#/room/:id` → 房间, `#/game/:id` → 游戏

**提交：** `feat(client): add React Router with hash-based routing`

---

## Task 16: 前端大厅 + 房间界面

**Files:**
- `packages/client/src/components/Lobby/Lobby.tsx`
- `packages/client/src/components/Lobby/RoomList.tsx`
- `packages/client/src/components/Lobby/CreateRoom.tsx`
- `packages/client/src/components/Room/RoomView.tsx`

**全部使用 Tailwind CSS**，不用内联样式。

**提交：** `feat(client): add lobby and room views with Tailwind`

---

## Task 17: 前端游戏界面

**Files:**
- `packages/client/src/components/Game/GameBoard.tsx` — 牌桌主视图
- `packages/client/src/components/Game/CardComponent.tsx` — 单张牌
- `packages/client/src/components/Game/PlayerHand.tsx` — 手牌
- `packages/client/src/components/Game/OpponentArea.tsx` — 对手区
- `packages/client/src/components/Game/PlayedCards.tsx` — 出牌展示
- `packages/client/src/components/Game/ActionBar.tsx` — 操作按钮
- `packages/client/src/components/Game/CallLandlord.tsx` — 叫分界面（1/2/3分按钮）
- `packages/client/src/components/Game/ScoreBoard.tsx` — 结算面板（倍率明细）

**全部使用 Tailwind CSS。**

**提交：** `feat(client): add game board with Tailwind UI`

---

## Task 18: 端到端联调

**测试场景清单：**

| # | 场景 | 通过标准 |
|---|------|----------|
| 1 | 创建房间 → 2人加入 → 3人准备 | 游戏开始，各收到手牌 |
| 2 | 叫分：有人叫 3 分 | 直接成为地主，收到底牌 |
| 3 | 叫分：全部不叫 × 3 次 | 强制指定地主 |
| 4 | 正常出牌→不出→轮次切换 | 轮次正确流转 |
| 5 | 炸弹/火箭打断 | 可压任何牌型 |
| 6 | 地主赢 / 农民赢 | 结算面板显示正确倍率和分数 |
| 7 | 春天：农民一张未出 | 倍率 ×2 显示正确 |
| 8 | 刷新页面后恢复 | 重连成功，手牌/状态恢复 |
| 9 | 断线 60 秒超时 | 判负，游戏结束 |
| 10 | 无效出牌 | 显示错误提示，不影响游戏 |

**提交：** `fix: address integration issues from e2e testing`

---

## 执行顺序

```
Task 1 (脚手架)
  ↓
Task 2-7 (shared 包，可顺序执行)
  ↓
Task 8-12 (server 包，顺序执行)
  ↓
Task 13-17 (client 包，13→14→15 后 16/17 可并行)
  ↓
Task 18 (联调)
```
