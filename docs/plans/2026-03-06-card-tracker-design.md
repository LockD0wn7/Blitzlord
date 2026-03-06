# 记牌器设计文档

> 日期：2026-03-06
> 状态：已确认，待进入实现计划

## 目标

为 Blitzlord 增加一个仅当前玩家可见的记牌器，满足以下约束：

- 支持刷新和断线重连后的完整恢复
- 默认折叠，通过按钮展开
- 展示“对手手里可能剩余的各点数张数”
- 展示按时间顺序记录的本局出牌历史，包含 `不出`
- 不做座位级推测牌，不把记牌器结果同步给其他玩家

## 已确认决策

- 数据恢复方式：服务端提供权威快照，客户端重连时整体覆盖
- 可见范围：只给自己看
- 面板形态：默认折叠，按钮展开
- 历史展示：按时间顺序展示每一手，`不出` 也记录
- 统计口径：显示“除自己当前手牌外，对手整体还可能剩余多少张该点数”

## 非目标

- 不做回放系统
- 不做旁观者视角
- 不做座位级推测，例如“左家可能有几张 2”
- 不做房间公共面板
- 不做跨设备同步面板展开状态

## 架构结论

记牌器拆成三层：

1. `server` 保存本局公共事实
2. `shared` 提供纯函数，根据“公共历史 + 当前玩家手牌”推导个人记牌快照
3. `client` 只做展示和局部增量更新，`game:syncState` 到来时以服务端快照整体覆盖

这样可以同时满足：

- 重连恢复稳定
- 统计口径统一
- 不泄露非公开信息
- 前端不会因为本地累积错误而长期漂移

## 数据模型

建议在 `packages/shared/src/types/game.ts` 中新增以下类型，并将 `GameSnapshot` 扩展为包含 `tracker` 字段：

```ts
export interface TrackerHistoryEntry {
  sequence: number;
  round: number;
  playerId: string;
  action: "play" | "pass";
  cards: Card[];
}

export interface TrackerRankStat {
  rank: Rank;
  totalCopies: number;
  playedCopies: number;
  myCopies: number;
  remainingOpponentCopies: number;
}

export interface CardTrackerSnapshot {
  history: TrackerHistoryEntry[];
  remainingByRank: TrackerRankStat[];
}
```

`round` 用于前端插入“新一轮”轻量分隔标记，避免客户端反推轮次。

`GameSnapshot` 新增：

```ts
tracker: CardTrackerSnapshot;
```

## 共享推导逻辑

建议新增 `packages/shared/src/utils/cardTracker.ts`，暴露一个纯函数，例如：

```ts
buildCardTrackerSnapshot(params: {
  myHand: Card[];
  history: TrackerHistoryEntry[];
}): CardTrackerSnapshot
```

推导规则：

- `history` 原样返回，作为玩家私有展示数据
- `remainingOpponentCopies` 的公式为：

```txt
该点数整副牌总张数
- 已公开打出的该点数张数
- 我当前手里的该点数张数
```

补充约束：

- 双王各自总数为 1
- 普通点数总数为 4
- `pass` 只进入历史，不扣减任何点数
- 地主拿到底牌后，因为 `myHand` 变化，重新推导即可得到正确统计

## 服务端职责

### 1. GameManager 保存公共历史

建议在 `packages/server/src/game/GameManager.ts` 中维护：

```ts
private trackerHistory: TrackerHistoryEntry[] = [];
private trackerSequence = 0;
private trackerRound = 1;
```

状态更新规则：

- `playCards` 成功后追加一条 `action: "play"` 记录
- `pass` 成功后追加一条 `action: "pass"` 记录
- 当连续两家 `pass` 导致牌权重置时，下一次有效出牌应进入新的 `round`
- 新开一局或重新发牌时清空历史并重置序号、轮次

### 2. getFullState 按玩家视角返回 tracker

`getFullState(playerId)` 在返回 `GameSnapshot` 时：

- 读取该玩家当前手牌
- 调用 shared 的 `buildCardTrackerSnapshot`
- 将结果挂到 `snapshot.tracker`

这样服务端只保存公共事实，不保存三份冗余的个人记牌结果。

## 客户端职责

### 状态管理

建议在 `packages/client/src/store/useGameStore.ts` 增加：

- `tracker: CardTrackerSnapshot`
- `isTrackerOpen: boolean`
- `syncTracker(snapshot: CardTrackerSnapshot)`
- `appendTrackerPlay(...)`
- `appendTrackerPass(...)`
- `toggleTrackerPanel()`

规则：

- `syncState` 时整体覆盖 `tracker`
- 正常对局收到 `game:cardsPlayed` / `game:passed` 时做本地增量更新
- 一旦再次收到 `game:syncState`，立即以快照覆盖本地 tracker，丢弃旧增量结果
- `isTrackerOpen` 只属于本地 UI 状态，不放进服务端快照

### 前端展示

前端实现必须显式使用 `frontend-design` 技能。

视觉方向固定为：

- 主题：`Imperial Night` 下的“战局密报板”
- 质感：暗色漆木、暗金包边、轻玻璃雾感
- 结构：上半区为点数谱，下半区为牌谱卷宗

布局结论：

- 入口位于 `GameBoard` 顶部信息栏右侧，按钮文案为 `记牌器`
- 桌面端从右侧滑出浮层，不推动牌桌重排
- 移动端从底部弹出半屏抽屉
- 历史区独立滚动，点数谱保持可见

展示内容：

- 点数谱按 `大王、小王、2、A ... 3` 排列
- 每个点数展示剩余数值和对应可视刻度
- 历史按时间倒序展示最新一手
- `pass` 显示为 `不出`
- 当 `round` 变化时插入轻量“新一轮”分隔标记

## 事件与同步策略

不新增独立的记牌器 Socket 事件。

继续使用现有对局事件流：

- `game:cardsPlayed`
- `game:passed`
- `game:started`
- `game:syncState`

仅扩展 `GameSnapshot`，让 `game:syncState` 一次性携带 `tracker`。

好处：

- 不增加事件面
- 正常对局仍走增量广播
- 刷新和重连时一次性恢复

## 异常与一致性处理

- 客户端记牌数据和服务端快照不一致时，以服务端快照为准
- `pass` 进入历史，但不参与点数扣减
- 游戏结束后记牌器仍可查看，直到离开对局页或新一局开始
- 新一局 `game:started` 时清空旧 tracker
- 用户不在游戏页时，不额外为记牌器发起独立同步请求

## 测试策略

### shared

- 新增 `cardTracker.test.ts`
- 验证普通牌、双王、`pass`、地主拿底牌后的推导结果

### server

- 扩展 `game.test.ts`
- 验证历史记录累积
- 验证 `getFullState(playerId)` 返回正确的 `tracker`
- 验证新局开始和重新发牌会清空历史

### client

- 为 `useGameStore` 增加测试
- 为记牌器展示组件增加测试
- UI 变更补充手动 smoke checklist

手动 smoke 至少覆盖：

- 默认折叠
- 点击展开和关闭
- 点数谱显示正确
- 出牌历史实时更新
- 刷新/重连后恢复
- 地主拿到底牌后统计口径正确

## 实现顺序

1. `shared`：类型 + 纯函数 + 单测
2. `server`：历史记录 + 快照集成 + 单测
3. `client`：store 状态 + 单测
4. `client`：UI 面板 + `GameBoard` 集成
5. 联调与手动 smoke

## 风险

- `GameManager` 当前是随机发牌，某些测试需要稳定构造牌局或注入历史
- `client` 目前没有现成测试脚本，若要严格执行 TDD，需要补齐最小 Vitest 支持
- UI 若直接塞入现有牌桌布局，容易破坏牌桌密度，因此必须坚持浮层方案
