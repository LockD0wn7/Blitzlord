# Blitzlord - 联机斗地主 Web 应用设计文档

> **版本：** v2（2026-03-02 审核修订版）
> **审核文档：** `2026-03-02-design-review.md`

## 概述

Blitzlord 是一个基于 Web 的多人在线斗地主游戏。玩家通过浏览器访问，创建或加入房间，与其他两名玩家进行实时斗地主对战。

## 技术选型

| 层级 | 技术 |
|------|------|
| 前端框架 | React + TypeScript |
| 前端构建 | Vite |
| 前端路由 | React Router (hash mode) |
| CSS 方案 | Tailwind CSS |
| 状态管理 | Zustand |
| 后端运行时 | Node.js + tsx |
| 实时通信 | Socket.IO |
| 包管理 | pnpm workspace (Monorepo) |
| 测试 | Vitest |
| 持久化 | 无（MVP 纯内存） |

## 项目结构

```
blitzlord/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .gitignore
├── packages/
│   ├── shared/                # 共享逻辑包
│   │   ├── src/
│   │   │   ├── types/         # TypeScript 类型定义
│   │   │   ├── rules/         # 斗地主规则引擎
│   │   │   ├── constants/     # 常量定义
│   │   │   └── utils/         # 工具函数（deck, sort, cardEquals）
│   │   ├── src/__tests__/     # 单元测试
│   │   └── package.json
│   ├── server/                # 后端服务
│   │   ├── src/
│   │   │   ├── game/          # 游戏状态管理
│   │   │   ├── room/          # 房间管理
│   │   │   ├── session/       # 玩家会话管理（token ↔ playerId）
│   │   │   ├── socket/        # Socket.IO 事件处理（工厂函数模式）
│   │   │   └── index.ts       # 入口
│   │   ├── src/__tests__/     # 单元 + 集成测试
│   │   └── package.json
│   └── client/                # 前端应用
│       ├── src/
│       │   ├── components/    # React 组件
│       │   ├── hooks/         # 自定义 hooks
│       │   ├── store/         # Zustand 状态管理
│       │   ├── socket/        # Socket.IO 客户端封装
│       │   ├── routes/        # React Router 路由配置
│       │   └── App.tsx
│       └── package.json
```

---

## 身份与连接管理

### 玩家身份

不依赖 `socket.id` 作为玩家身份。改用持久化 token：

1. 客户端首次访问时生成 UUID，存入 `localStorage`（关闭标签页后仍可重连）
2. Socket.IO 连接时通过 `auth.token` 传递
3. 服务端维护 `token → PlayerSession` 映射
4. 断线重连时携带相同 token，服务端恢复身份

```typescript
// 客户端连接
const token = localStorage.getItem('playerId') || crypto.randomUUID();
localStorage.setItem('playerId', token);
const socket = io(SERVER_URL, { auth: { token } });

// 服务端
interface PlayerSession {
  playerId: string;       // = token
  socketId: string | null; // 当前 socket，断线时为 null
  playerName: string;
  roomId: string | null;
  disconnectedAt: number | null; // 断线时间戳
}
```

### 断线重连

- 玩家断线后，服务端保留其座位 **60 秒**
- 60 秒内重连（携带相同 token）→ 恢复身份，推送完整状态快照
- 60 秒超时 → 该玩家判负，游戏结束
- 其他在线玩家看到"等待 xxx 重连...（倒计时）"

### 主动离开

- 游戏中玩家主动点击"离开房间"（`room:leave`）= 主动放弃
- **立即判负**，游戏结束，不走 60 秒等待窗口
- 与断线（被动掉线）的区别：断线等 60 秒，主动离开立即生效

### 状态同步

增加 `game:syncState` 事件：
- 客户端重连后，服务端主动推送完整游戏状态快照
- 客户端也可以主动请求 `game:requestSync`
- 快照类型 `GameSnapshot`，包含：
  - 自己的手牌（其他玩家只含牌数）
  - 当前阶段、轮次、地主 ID
  - 底牌、上一手牌、叫分进展
  - 炸弹计数、得分状态
  - 各玩家剩余牌数和出牌次数

### 昵称持久化

玩家昵称存入 `localStorage`，刷新页面后自动填充。

---

## 核心游戏逻辑（shared 包）

### 数据模型

```typescript
enum Suit { Spade = 'spade', Heart = 'heart', Diamond = 'diamond', Club = 'club' }

enum Rank {
  Three = 3, Four, Five, Six, Seven, Eight, Nine, Ten,
  Jack, Queen, King, Ace, Two, BlackJoker, RedJoker
}

interface Card {
  suit: Suit | null;  // 大小王的 suit 为 null
  rank: Rank;
}
```

### 工具函数

- `cardEquals(a: Card, b: Card): boolean` — 牌面相等比较（避免到处重复 `rank === && suit ===`）
- `sortCards(cards: Card[]): Card[]` — 手牌排序
- `createDeck() / shuffleDeck() / dealCards()` — 洗牌发牌

### 牌型

| 牌型 | 说明 |
|------|------|
| 单张 | 任意 1 张 |
| 对子 | 2 张相同 |
| 三张 | 3 张相同 |
| 三带一 | 3 张 + 1 张 |
| 三带二 | 3 张 + 1 对 |
| 顺子 | 5+ 张连续单张（3-A，不含 2 和王） |
| 连对 | 3+ 对连续对子 |
| 飞机不带 | 2+ 组连续三张 |
| 飞机带单 | 飞机 + 等量单张 |
| 飞机带对 | 飞机 + 等量对子 |
| 炸弹 | 4 张相同 |
| 火箭 | 大小王 |
| 四带二 | 4 张 + 2 张单（或 2 对） |

### 牌型识别算法要点

**四带二歧义处理：** 8 张牌可能同时匹配"四带两对"和"飞机带单"。判定优先级：
1. 先检查是否有 4 张相同的牌（四带二系列）
2. 再检查是否有连续三张（飞机系列）
3. 四带二优先级高于飞机（因为四带二包含炸弹能力的衍生牌型）

### 规则引擎模块

- `cardType.ts` — 牌型识别
- `cardCompare.ts` — 牌型比较
- `validator.ts` — 出牌合法性验证
- `scoring.ts` — 计分系统
- `deck.ts` — 洗牌、发牌（17+17+17+3）

---

## 叫地主规则（标准抢地主）

采用标准叫分制，非简化版"叫/不叫"：

1. 随机选一个玩家开始叫分
2. 可叫 1 分、2 分、3 分，或不叫
3. 按顺序轮转，**每人有且仅有一次叫分机会**
4. 后续玩家可叫更高分数，或不叫
5. 叫 3 分直接成为地主（封顶，不再继续）
6. 一轮结束后，最高分者为地主
6. 全部不叫 → 重新发牌（**最多 3 次**）
7. 3 次全部不叫 → 强制随机指定一人为地主（叫 1 分）

叫分值作为基础倍率，影响最终计分。

---

## 计分系统

### 基础公式

```
最终得分 = 基础分 × 叫分倍率 × 炸弹/火箭倍率 × 春天倍率
```

### 倍率说明

| 倍率类型 | 说明 |
|----------|------|
| 基础分 | 固定 1 分 |
| 叫分倍率 | 叫的分数（1/2/3） |
| 炸弹倍率 | 每出一个炸弹 ×2 |
| 火箭倍率 | 出火箭 ×2 |
| 春天倍率 | 触发春天 ×2 |

### 春天规则

- **地主春天：** 地主出完所有牌，两个农民一张都没出过 → 倍率 ×2
- **反春天：** 地主只出过一手牌（第一手），之后农民先出完 → 倍率 ×2

### 结算

- 地主赢：两个农民各扣 `最终得分`，地主得 `最终得分 × 2`
- 农民赢：地主扣 `最终得分 × 2`，两个农民各得 `最终得分`

---

## 后端架构（server 包）

### 会话管理（session 模块）

```
server/src/session/
└── SessionManager.ts    # token → PlayerSession 映射，断线超时管理
```

### 房间系统

```
server/src/room/
├── Room.ts              # 单个房间（封装状态转换方法）
└── RoomManager.ts       # 房间管理器
```

**Room 封装原则：** 不直接修改 Room 的属性，通过方法管理状态转换：
- `room.startPlaying()` — 设置状态为 playing
- `room.finishGame()` — 设置状态为 finished
- `room.resetReady()` — 重置所有玩家准备状态
- `room.backToWaiting()` — 回到等待状态

**房间生命周期：**
1. 玩家创建房间 → 生成房间 ID → 等待状态
2. 其他玩家通过房间列表或房间号加入
3. 3 人齐全且都准备 → 开始游戏
4. 游戏结束 → 回到等待状态
5. 所有人离开 → 房间销毁

**房间状态：** `waiting` → `playing` → `finished` → `waiting`（循环）

### 游戏状态机

```
server/src/game/
└── GameManager.ts       # 游戏状态机（含计分、春天判定）
```

**阶段：**
1. **发牌** — 洗牌，每人 17 张，3 张底牌暗扣
2. **叫地主** — 标准叫分制（1/2/3 分），最多 3 轮重发
3. **出牌** — 地主先出，轮流出牌，可 pass，记录炸弹/火箭倍率
4. **结算** — 判断胜负、春天、计算得分

### Socket 事件处理（工厂函数模式）

```
server/src/socket/
└── handlers.ts          # createHandlers(deps) 工厂函数
```

**依赖注入，非全局单例：**
```typescript
export function createHandlers(deps: {
  roomManager: RoomManager;
  sessionManager: SessionManager;
  games: Map<string, GameManager>;
}) { ... }
```

### Socket.IO 事件

**客户端 → 服务端：**

| 事件 | 说明 |
|------|------|
| `room:create` | 创建房间 |
| `room:join` | 加入房间 |
| `room:leave` | 离开房间 |
| `room:list` | 获取房间列表 |
| `game:ready` | 玩家准备 |
| `game:callLandlord` | 叫分（1/2/3）或不叫 |
| `game:playCards` | 出牌 |
| `game:pass` | 不出 |
| `game:requestSync` | 请求状态同步 |

**服务端 → 客户端：**

| 事件 | 说明 |
|------|------|
| `room:updated` | 房间状态更新 |
| `game:started` | 游戏开始（附手牌、首个叫分者） |
| `game:callUpdate` | 叫分进展（谁叫了几分/不叫） |
| `game:landlordDecided` | 地主确定（附底牌、叫分倍率） |
| `game:turnChanged` | 轮次变化 |
| `game:cardsPlayed` | 有人出牌（附剩余牌数） |
| `game:passed` | 有人不出 |
| `game:ended` | 游戏结束（附胜负、得分明细） |
| `game:syncState` | 完整状态快照（重连用） |
| `player:disconnected` | 有玩家断线 |
| `player:reconnected` | 有玩家重连 |
| `error` | 错误消息 |

---

## 前端架构（client 包）

### 路由（React Router, hash mode）

| 路径 | 视图 |
|------|------|
| `#/` | 登录/昵称输入 |
| `#/lobby` | 大厅（房间列表） |
| `#/room/:roomId` | 房间等待 |
| `#/game/:roomId` | 游戏中 |

好处：浏览器后退有效、可分享房间链接、刷新保持页面。

### 核心组件

```
components/
├── Lobby/
│   ├── RoomList.tsx        # 房间列表
│   └── CreateRoom.tsx      # 创建房间
├── Room/
│   └── RoomView.tsx        # 房间等待界面
├── Game/
│   ├── GameBoard.tsx       # 牌桌主视图
│   ├── PlayerHand.tsx      # 当前玩家手牌
│   ├── OpponentArea.tsx    # 对手区域
│   ├── PlayedCards.tsx     # 已出牌展示
│   ├── ActionBar.tsx       # 操作按钮
│   ├── CallLandlord.tsx    # 叫地主/叫分界面
│   └── ScoreBoard.tsx      # 结算计分面板
└── shared/
    └── Card.tsx            # 单张牌组件
```

### 状态管理

```
store/
├── useGameStore.ts    # 游戏状态
├── useRoomStore.ts    # 房间状态
└── useSocketStore.ts  # Socket 连接状态 + token 管理
```

### 数据流

```
Socket.IO 事件 → Zustand Store → React 组件重渲染
用户操作 → Socket.IO 发送 → 服务端处理 → 广播所有玩家
重连 → auth.token → 服务端恢复身份 → game:syncState → Store 重建
```

---

## 测试策略

| 层级 | 范围 | 方式 |
|------|------|------|
| shared 单元测试 | 牌型识别、比较、验证、排序、计分 | Vitest |
| server 单元测试 | Room、RoomManager、GameManager、SessionManager | Vitest |
| server 集成测试 | Socket handlers 完整事件流 | Vitest + socket.io-client |
| 手动 e2e | 3 浏览器标签联调 | 具体场景清单（见下） |

### e2e 测试场景清单

1. 创建房间 → 2人加入 → 3人准备 → 游戏开始
2. 叫分流程：有人叫 3 分直接成为地主
3. 叫分流程：全部不叫 → 重新发牌
4. 出牌流程：正常出牌→不出→轮次切换
5. 出牌流程：炸弹/火箭打断
6. 游戏结束：地主赢 / 农民赢 → 结算展示
7. 春天判定：农民一张未出
8. 断线重连：刷新页面后恢复游戏状态
9. 断线超时：60 秒后判负
10. 房间离开：游戏中退出 → 其余玩家处理
