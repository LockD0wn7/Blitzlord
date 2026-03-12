# 机器人玩家设计文档

## 背景

当前项目的房间与对局流程默认假设一局必须由 3 个真人组成：

- 房间玩家由 `playerId + playerName + isReady + isOnline + seatIndex` 表示，没有玩家类型概念
- 房间只有“满 3 人且所有人 ready”才会开局
- 对局动作只能从 Socket 事件进入，默认每个玩家背后都有真实会话

这会带来两个明显问题：

1. 本地联调和测试门槛高，想验证完整牌局必须同时准备 3 个真人连接
2. 人数不足时无法先开始游玩，也没有为后续托管、AI 接管预留清晰边界

本次设计的目标是在不重做现有对局内核的前提下，为系统增加“机器人玩家”这一等价玩家类型。

## 目标

本次设计完成后，系统应满足以下目标：

1. 房间等待阶段可以手动添加和移除机器人
2. 机器人可以占用座位、参与房间同步，并在 UI 上明确显示为机器人
3. 机器人加入后自动 ready
4. 只要房间满员且所有真人 ready，机器人可以和真人一起正常开局
5. 机器人能够自动叫分、自动出牌、自动过牌，完整推进牌局
6. 机器人动作必须合法，并复用现有规则层，而不是额外维护一套牌型判定
7. 首版策略只追求“稳定、合法、可推进”，不追求智能
8. 架构需要为后续托管、AI 智能对局、AI 接管牌局保留扩展点

## 非目标

本次不做以下内容：

- 不引入房主体系或房主移交
- 不实现复杂牌力评估、队友协作或残局搜索
- 不实现机器人参与配置投票
- 不实现真人中途切换为托管
- 不实现外部大模型或远程 AI 服务接入

## 方案选择

本次评估过三条路径：

### 方案一：服务端 `BotController` 直接驱动对局

- 把机器人建模为 `playerType = "bot"` 的正式玩家
- 房间层负责机器人座位、名称、ready 状态和生命周期
- 对局动作不经过 socket，而是由服务端机器人控制器直接调用 `MatchEngine.dispatch(...)`

优点：

- 不污染真人会话模型
- 机器人和真人共享同一套房间/对局状态
- 后续托管和 AI 接管都可以复用这一层

缺点：

- 需要补一个“非 socket 驱动”的服务端动作入口

### 方案二：给机器人伪造 session/socket

- 机器人也注册为特殊 session
- 继续沿用现有 `handlers.ts` 的 socket 入口触发 ready 和 action

优点：

- 表面上复用现有流程较多

缺点：

- 机器人生命周期与 socket 强绑定，结构混乱
- 断线、离房、托管等扩展会变得难维护

### 方案三：重构为统一 actor / command bus

- 真人、机器人、托管都走统一动作源抽象
- socket 仅作为其中一种输入适配器

优点：

- 长期最干净

缺点：

- 首版成本过高，超出当前目标

### 结论

选择方案一：在现有房间和对局模型之上新增 `BotController`，由服务端直接驱动机器人动作。

这是当前侵入度、可维护性和后续扩展性之间最平衡的方案。

## 核心设计

### 1. 玩家类型建模

需要把“玩家是否为机器人”提升为共享类型的一部分。

涉及文件：

- `packages/shared/src/types/room.ts`
- `packages/shared/src/types/game.ts`
- `packages/server/src/platform/types.ts`

设计：

```ts
export type PlayerType = "human" | "bot";
```

房间玩家和对局快照玩家都增加：

```ts
playerType: PlayerType;
```

这样客户端、服务端、测试和未来托管逻辑都可以统一依赖该字段，而不是根据 `playerId` 前缀做隐式判断。

### 2. 机器人标识与命名

机器人 `playerId` 由服务端生成，避免与真人 token 冲突。

建议格式：

```ts
bot:<roomId>:<counter>
```

机器人名称使用简单稳定规则：

```ts
机器人 1
机器人 2
```

首版不引入机器人档案、头像、难度和性格字段。

### 3. 房间层职责

涉及文件：

- `packages/server/src/room/Room.ts`
- `packages/server/src/room/RoomManager.ts`

房间层新增职责：

- 支持添加机器人玩家
- 支持按 `playerId` 移除机器人
- 机器人加入后默认 `isReady = true`
- `allReady` 从“所有玩家 ready”调整为“房间已满且所有真人 ready，机器人默认视为 ready”

等待阶段的规则：

- 只有 `RoomStatus.Waiting` 允许加减机器人
- 任意房间内真人都可以加减机器人
- 房间内最后一个真人离开时，房间和机器人一起销毁

## 事件与数据流

### 1. 新增房间事件

涉及文件：

- `packages/shared/src/types/events.ts`
- `packages/server/src/socket/handlers.ts`
- `packages/client/src/socket/index.ts`

新增事件：

```ts
"room:addBot": (
  callback: (res: { ok: boolean; error?: string; playerId?: string }) => void,
) => void;

"room:removeBot": (
  data: { playerId: string },
  callback: (res: { ok: boolean; error?: string }) => void,
) => void;
```

规则：

- 只有房间内真人可调用
- 只有等待阶段可调用
- `room:addBot` 在房间已满时返回错误
- `room:removeBot` 只能移除机器人，不能移除真人

### 2. 开局流程

现状：

- 所有人都必须 `isReady = true`

调整后：

- 真人仍需手动点击 ready
- 机器人加入后自动 ready
- 房间满员且所有真人 ready 时立即开局

这样可以保留真人明确确认开局的控制点，同时消除机器人操作负担。

### 3. 对局动作入口收敛

现有问题：

- 真人动作流程直接写在 `handlers.ts` 中
- 机器人没有 socket，无法复用这段流程

调整后：

- 抽一个共享的服务端 helper，例如 `MatchCoordinator`
- 真人 socket 事件和机器人控制器都通过该 helper 推进对局

统一职责：

- 调用 `game.dispatch(...)`
- 广播 `match:syncState`
- 处理 `match:ended`
- 更新 `room` 状态
- 更新 `room:listUpdated`
- 在动作结束后再次触发机器人调度

这样可以避免“真人一套、机器人一套”的重复结算逻辑。

## BotController 设计

涉及文件：

- `packages/server/src/bot/BotController.ts`
- `packages/server/src/bot/strategy.ts`
- `packages/server/src/bot/types.ts`

### 1. 调度模型

`BotController` 维护每个房间一个待执行 timer，避免同一房间重复调度。

核心行为：

- `scheduleIfNeeded(roomId)`
- `cancel(roomId)`
- `cancelAllForRoom(roomId)`

触发时机：

- `room:addBot` 成功后
- 开局成功后
- 真人动作完成后
- 机器人动作完成后
- 重新发牌后
- 房间销毁或对局结束后

执行前必须再次校验：

- 房间仍然存在
- 对局仍然存在
- 当前阶段仍可行动
- 当前轮次仍属于同一个机器人

否则直接丢弃本次 timer。

### 2. 延时策略

为了避免动作过于机械，机器人行动使用短随机延时：

```ts
600ms - 1200ms
```

首版不做可配置速度。

## 机器人策略

首版策略只追求合法推进，不追求智能。

### 1. 叫分策略

不做牌力评估。

轮到机器人叫分时：

- 计算当前合法可叫分值集合
- 从集合中随机选择一个

例如：

- 当前最高分是 `0`，可从 `0/1/2/3` 随机
- 当前最高分是 `1`，可从 `0/2/3` 随机
- 当前最高分是 `2`，可从 `0/3` 随机

### 2. 出牌策略

直接复用现有规则层的 `getPlayableHints(...)`。

规则：

- 如果有合法可出牌，从 hints 中随机选一组牌打出
- 如果没有合法牌可接，则执行 `pass`
- 如果是新一轮起手，同样从可出的 hints 中随机选一组

### 3. 复用现有规则层

这是首版的关键约束：

- 不手写牌型搜索
- 不复制客户端提示算法
- 直接在服务端调用 shared 里的提示能力生成合法动作

这样能保证机器人动作与现有规则判定严格一致。

## 异常处理

### 1. 机器人动作失败

正常情况下，机器人动作在 `hints` 约束下应始终合法。

如果仍然出现 `dispatch` 失败：

- 记录日志，包含 `roomId`、`playerId`、阶段和动作内容
- 叫分失败时回退为 `0`
- 出牌失败时，如果当前允许 `pass` 则改为 `pass`
- 如果仍失败，则停止本次机器人行动，等待下一次状态同步重新调度

首版不做无限重试。

### 2. 房间与对局清理

需要在以下情况清理定时器：

- 房间销毁
- 对局结束
- 机器人被移除
- 真人离房导致房间重置

避免出现过期 timer 对已结束房间继续出牌。

### 3. 配置投票

机器人不参与 `room:voteConfigChange`

理由：

- 配置属于真人意图
- 如果机器人参与，票数门槛会被机器人稀释
- 首版不需要赋予机器人“房间治理权”

因此配置投票统计口径调整为“仅真人计票”。

## 前端表现

涉及文件：

- `packages/client/src/components/Room/RoomView.tsx`
- `packages/client/src/components/Game/GameBoard.tsx`
- `packages/client/src/components/Game/OpponentArea.tsx`
- `packages/client/src/components/Game/PlayedCards.tsx`
- `packages/client/src/components/Game/CardTrackerPanel.tsx`
- `packages/client/src/components/Game/ScoreBoard.tsx`

首版最小要求：

1. 房间页支持手动添加机器人和移除机器人
2. 房间座位明确显示玩家类型
3. 游戏页左右对手明确显示“机器人”标签
4. 出牌记录、记牌器、结算页保持玩家类型展示一致

大厅页是否显示“真人/机器人构成”不是首版必需项，可以延后。

## 测试策略

### server 单元测试

补充：

- `room.test.ts`
  - 添加机器人
  - 移除机器人
  - 房间满员 + 所有真人 ready 时可开局
  - 投票只统计真人

- `bot controller` 测试
  - 当前轮到机器人时会自动叫分
  - 当前轮到机器人时会自动出牌或过牌
  - 不会重复调度
  - 过期 timer 不会误执行

### server 集成测试

补充：

- `handlers.test.ts`
  - `room:addBot` / `room:removeBot`
  - 1 真人 + 2 机器人可以正常开局
  - 机器人能推进至少一轮叫分和一轮出牌

### client 测试

补充：

- 房间页显示机器人标签和操作按钮
- 游戏页对手区显示机器人标签
- 共享 store 能保存 `playerType`

## 扩展方向

本次设计完成后，后续功能可以沿着同一边界继续扩展：

1. 托管：把真人临时切换为 `BotController` 接管动作，但不改变 `playerType`
2. AI 智能对局：替换 `strategy.ts` 的决策函数
3. AI 接管牌局：在托管入口上增加更强策略模型
4. 机器人档案：增加难度、性格、速度、昵称风格等

## 最终结论

首版机器人玩家应按“正式玩家 + 服务端动作驱动”的模式落地：

- 房间层负责机器人座位和生命周期
- 共享类型负责暴露玩家类型
- 服务端 `BotController` 负责自动 ready、自动叫分、自动出牌
- 决策层只做最低智能，完全复用现有合法动作生成能力

这样既能满足测试与补位需求，也能为后续托管和 AI 扩展留下稳定边界。
