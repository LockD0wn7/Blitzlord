# Code Review: Server 包核心模块

**日期:** 2026-03-02
**范围:** `packages/server/src/` 下新增的 `session/`、`room/`、`game/` 模块及对应测试
**测试状态:** 全部通过（shared 91 + server 66 = 157 tests）

---

## 概述

本次新增 server 包的三大核心模块：`SessionManager`（身份会话管理）、`Room` + `RoomManager`（房间管理）、`GameManager`（游戏状态机），以及对应的 66 个单元测试。整体代码质量较高，结构清晰，符合 CLAUDE.md 中的设计决策。

## 审查文件

| 文件 | 行数 | 说明 |
|------|------|------|
| `session/SessionManager.ts` | 101 | token↔socket 双向映射，断线/重连管理 |
| `room/Room.ts` | 127 | 房间实体，座位分配/状态转换/序列化 |
| `room/RoomManager.ts` | 68 | 房间容器，创建/加入/离开/查找 |
| `game/GameManager.ts` | 509 | 游戏状态机，叫分/出牌/断线/快照 |
| `index.ts` | 22 | 服务入口（基础 Socket.IO 骨架） |
| `__tests__/session.test.ts` | 121 | SessionManager 测试（14 cases） |
| `__tests__/room.test.ts` | 203 | Room + RoomManager 测试（23 cases） |
| `__tests__/game.test.ts` | 330 | GameManager 测试（29 cases） |

## 优点

- 模块划分清晰，职责单一，符合设计文档的分层架构
- Room 通过方法封装状态变更（`startPlaying()` / `finishGame()` / `backToWaiting()`），符合设计规范
- SessionManager 的双向映射（`byToken` / `socketToToken`）设计简洁高效
- GameManager 状态机逻辑完整，覆盖发牌、叫分、出牌、断线处理
- 牌面比较一律使用 `cardEquals()`，符合编码规范
- 测试覆盖全面，中文测试描述可读性好
- `toRoomDetail()` 返回 players 的浅拷贝，避免外部修改内部状态

---

## 需要修复的问题

### 🔴 [blocking] 断线超时 + 叫分阶段的春天误判 bug

**位置:** `GameManager.ts:452-458`

叫分阶段断线超时时，强制分配角色后调用 `endGame()`。此时所有玩家的 `playCount` 都是 0。`isSpring(0, [0, 0])` 会检测到"两个农民出牌次数都为 0"，误判为春天，导致得分翻倍。

```typescript
// GameManager.ts:452-458
if (this.state.phase === GamePhase.Calling) {
  for (const p of this.state.players) {
    p.role = p.playerId === playerId ? PlayerRole.Landlord : PlayerRole.Peasant;
  }
  this.state.phase = GamePhase.Playing;
}
// 之后调用 endGame → isSpring(0, [0, 0]) → true（误判！）
```

**建议修复：** 在 `handleDisconnectTimeout` 中跳过春天检测，或在 `endGame` 前将断线者的 `playCount` 设为一个非零值以避免误判。更好的方式是在 `endGame` 中检查是否实际进行了出牌。

---

### 🔴 [blocking] Room.ts 使用 string 字面量代替 enum 值

**位置:** `Room.ts:6,85,91,102`

多处使用 `"waiting" as RoomStatus` 字面量强转，而不是使用 `RoomStatus.Waiting` 枚举值。这违背了使用枚举的初衷，失去类型安全保护。

```typescript
// ❌ 当前写法
private _status: RoomStatus = "waiting" as RoomStatus;
this._status = "playing" as RoomStatus;
this._status = "finished" as RoomStatus;

// ✅ 应改为
import { RoomStatus } from "@blitzlord/shared";
private _status: RoomStatus = RoomStatus.Waiting;
this._status = RoomStatus.Playing;
this._status = RoomStatus.Finished;
```

---

## 建议改进

### 🟡 [important] RoomManager.createRoom UUID 截断无碰撞检测

**位置:** `RoomManager.ts:10`

`randomUUID().slice(0, 8)` 只有 32 bit 熵，虽然 MVP 阶段房间数很少碰撞概率极低，但建议加一个简单的碰撞循环：

```typescript
let roomId: string;
do {
  roomId = randomUUID().slice(0, 8);
} while (this.rooms.has(roomId));
```

### 🟡 [important] index.ts 未集成新模块

`index.ts` 只有基础的 Socket.IO 连接/断线日志，没有使用 `SessionManager`、`RoomManager`、`GameManager`。这些模块目前处于"已实现但未接线"状态。下一步应实现 `createHandlers()` 工厂函数完成集成。

### 🟡 [important] 测试缺失：游戏完整流程 & 计分

`game.test.ts` 缺少以下测试场景：

- 完整的一局游戏测试（出完牌 → 触发 `gameEnd` → 验证计分）
- 出炸弹后 `bombCount` 递增的验证（目前只检查了初始值为 0）
- 火箭使用后 `rocketUsed` 标记的验证
- 断线超时时春天误判的回归测试

### 💡 [suggestion] GameManager 中的 find 可提取为私有方法

`GameManager.ts` 中多处使用 `this.state.players.find(p => p.playerId === id)!` 模式，带非空断言。考虑提取为 `private getPlayerState(id: string): PlayerState`，统一处理查找失败的情况。

### 🟢 [nit] RoomManager.joinRoom 的 status 检查

**位置:** `RoomManager.ts:34`

检查 `room.status !== "waiting"` 使用了字面量字符串，与 Room.ts 同样的问题，建议用 `RoomStatus.Waiting`。

---

## 测试质量

| 模块 | 测试数 | 覆盖评估 |
|------|--------|----------|
| SessionManager | 14 | 全面，包含边界情况 |
| Room + RoomManager | 23 | 良好，覆盖座位分配/状态转换/自动销毁 |
| GameManager | 29 | 良好，但缺少完整游戏结束和计分验证 |

## 判定

🔄 **Request Changes** — 请先修复以下两个 blocking 问题：

1. 断线超时的春天误判 bug（`GameManager.ts:handleDisconnectTimeout`）
2. Room.ts 中 `as RoomStatus` 类型强转改为使用枚举值

修复后可以合入。其他 suggestion 级别的建议可后续处理。

---

## 修复总结

**修复日期:** 2026-03-02

所有 blocking 问题已修复，同时处理了 important 和 suggestion 级别的建议。测试全部通过（shared 91 + server 72 = 163 tests）。

| 问题 | 级别 | 修复方式 |
|------|------|----------|
| 春天误判 bug | 🔴 blocking | `endGame` 中增加 `anyPlayed` 检查，无人出牌时跳过春天检测 |
| Room.ts 枚举强转 | 🔴 blocking | 全部改用 `RoomStatus.Waiting/Playing/Finished` 枚举值 |
| RoomManager.joinRoom status 检查 | 🟢 nit | 同样改用 `RoomStatus.Waiting` |
| UUID 碰撞检测 | 🟡 important | `createRoom` 中加 `do-while` 碰撞循环 |
| 缺失测试 | 🟡 important | 新增 6 个测试：完整游戏流程、炸弹/火箭计数、春天误判回归测试 |
| find 重复模式 | 💡 suggestion | 提取 `getPlayerState()` 私有方法，统一查找逻辑 |
