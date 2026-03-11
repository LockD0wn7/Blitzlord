# 平台化重构设计文档

## 背景

当前仓库已经支持“斗地主标准模式”和“斗地主赖子模式”，但现有实现仍以斗地主为唯一中心展开：

- 房间和事件协议以 `wildcard: boolean` 驱动模式差异
- 服务端对局运行时直接持有斗地主专属状态
- shared 根类型里泄漏了 `wildcardRank`、`softBomb`、`pureWild` 这类玩法私有字段
- 客户端房间页、对局页和 store 默认假设当前游戏就是斗地主

这套结构可以继续堆玩法，但不支持长期演进成“多游戏网站平台”。

## 目标

本次重构后的完成标准：

1. 房间创建必须基于 `gameId + modeId`
2. 斗地主标准模式和斗地主赖子模式都通过同一套平台注册机制运行
3. 平台根类型里不再出现 `wildcard` / `wildcardRank` 这类斗地主私有字段
4. 当前两种模式的规则行为、房间流和主流程测试保持通过

本次不做：

- 不接入第二个非斗地主游戏
- 不接入外部底层框架
- 不保留旧协议兼容层
- 不做插件市场或动态热加载

## 路径选择

本次评估过三条路径：

1. 保留现有 Socket.IO 架构，仅做内部抽象
2. 直接迁移到 Colyseus
3. 保留现有通信层，但把游戏内核彻底抽成平台层

选择第 3 条路径。

原因：

- 当前验收标准不是替换网络底座，而是让现有站点具备平台化内核
- 直接迁移 Colyseus 会把风险同时扩散到规则层、房间层、同步层和客户端通信层
- 保留现有 monorepo 与 Socket.IO 可以控制重构面，把主要精力投入到抽象边界与协议重塑

## 核心抽象

### 1. `GameDefinition`

表示一个游戏本体，例如 `doudizhu`。它负责声明：

- `gameId`
- 展示名称
- 支持的模式列表
- 该游戏的前端视图入口
- 该游戏的对局创建方式

### 2. `ModeDefinition`

表示同一游戏下的规则变体，例如 `classic` 与 `wildcard`。它负责声明：

- `modeId`
- 展示名称
- 展示文案
- 默认配置
- 对应的规则实现

### 3. `RuleSet`

这是规则内核，负责收口模式差异，至少包括：

- `setupMatch`
- `identifyPlay`
- `canBeat`
- `getHints`
- `validatePlay`
- `scoreMatch`
- `toDisplayState`

平台层不应再知道什么叫顺子、飞机、赖子炸。

### 4. `MatchEngine`

这是服务端平台运行时。它不再持有“赖子模式”这种业务分支，只负责：

- 初始化和保存对局状态
- 驱动阶段流转
- 分发玩家 action
- 调用当前 `RuleSet`
- 产出统一 snapshot / events

落地后的组合关系：

- 斗地主标准模式 = `doudizhu + classic + DoudizhuClassicRuleSet`
- 斗地主赖子模式 = `doudizhu + wildcard + DoudizhuWildcardRuleSet`

## 目录与边界重构

### shared

保留 `packages/shared`，但按“平台核心”和“游戏实现”重组。

新增：

- `src/platform/`
  - `gameDefinition.ts`
  - `modeDefinition.ts`
  - `ruleSet.ts`
  - `matchTypes.ts`
  - `registry.ts`

- `src/games/doudizhu/`
  - `definition.ts`
  - `modes/classic.ts`
  - `modes/wildcard.ts`
  - `rules/common/*`
  - `rules/classic/*`
  - `rules/wildcard/*`
  - `types.ts`

现有 shared 根部的斗地主规则文件将迁入 `games/doudizhu`。平台根部只保留平台无关抽象。

### server

新增：

- `src/platform/MatchEngine.ts`
- `src/platform/GameRegistry.ts`
- `src/platform/actionHandlers.ts`

现有 `GameManager` 将被拆分：

- 通用对局推进能力进入 `MatchEngine`
- 斗地主专属阶段、状态、规则调用进入 `games/doudizhu` 适配层

### client

新增：

- `src/platform/`
  - 游戏注册表
  - 通用房间壳
  - 通用对局装载壳

- `src/games/doudizhu/`
  - 斗地主房间视图
  - 斗地主对局视图
  - 斗地主模式文案与适配逻辑

本次仍采用静态注册，不做动态模块加载。

## 类型模型重构

平台通用类型只保留平台概念，例如：

- `gameId`
- `modeId`
- `roomConfig`
- `matchSnapshotBase`
- `playerActionEnvelope`

斗地主专属类型下沉到 `games/doudizhu`，例如：

- `DoudizhuCard`
- `DoudizhuPlay`
- `DoudizhuMatchState`
- `DoudizhuModeConfig`

这意味着：

- `RoomInfo` / `RoomDetail` 不再包含 `wildcard: boolean`
- 平台 `GameSnapshot` 不再包含 `wildcardRank`
- `CardPlay` 不再作为全平台通用牌型结构暴露给所有游戏

斗地主赖子相关扩展元数据应收敛到斗地主自己的 play/meta 结构中。

## 通信协议重构

### 房间创建

现有：

```ts
room:create({ roomName, wildcard })
```

目标：

```ts
room:create({ roomName, gameId, modeId, config? })
```

房间从创建开始就必须绑定“游戏 + 模式”。

### 房间详情

房间详情需要统一展示字段：

- `gameId`
- `gameName`
- `modeId`
- `modeName`
- `configSummary`

大厅和房间页不得再硬编码“赖子房”这一概念。

### 配置变更投票

现有 `room:voteMode` 将重构为：

```ts
room:voteConfigChange({ gameId?, modeId?, configPatch? })
```

本次先用于同游戏内模式切换：

- 斗地主经典 -> 斗地主赖子
- 斗地主赖子 -> 斗地主经典

协议层不再暴露 `wildcard: boolean`。

### 对局事件

本次不把所有游戏动作都改造成完全动态协议，而是采用“两层事件”：

- 平台通用事件：
  - `room:create`
  - `room:updated`
  - `match:started`
  - `match:syncState`
  - `match:ended`

- 游戏动作统一进入：

```ts
match:action({ type, payload })
```

斗地主内部动作再定义为：

- `callBid`
- `playCards`
- `pass`

这样未来新增游戏时，只需要增加 action type，而不需要再扩展一套新的 Socket 事件名。

## 客户端加载模型

客户端不再假设“进房就是斗地主”。

重构后流程：

1. 房间页根据 `gameId + modeId` 读取平台注册表
2. 从注册表装载对应游戏的房间渲染器
3. 对局路由使用通用壳加载对应游戏的对局视图
4. 斗地主只是当前唯一已注册游戏

本次重构完成后，虽然平台里仍只有斗地主，但前端结构已经具备按游戏挂载 UI 的能力。

## 兼容策略

本次不保留旧协议兼容层，直接整体迁移到新协议。

原因：

- 当前任务是平台级重构，不是在线灰度迁移
- 双协议并存会显著放大 shared/server/client 三层复杂度
- 保留旧协议会掩盖边界问题，拖慢平台抽象落地

## 测试策略

### shared

- 保留并迁移现有斗地主经典规则测试
- 保留并迁移现有赖子专项测试
- 新增平台层测试：
  - 注册表根据 `gameId + modeId` 正确解析定义
  - `RuleSet` 能统一调用
  - 平台根类型不再泄漏斗地主私有字段

### server

新增平台化集成测试：

- 创建斗地主经典房间并开局
- 创建斗地主赖子房间并开局
- 模式切换投票通过后按新模式启动
- `match:action` 能正确分发到斗地主动作处理

### client

至少补充：

- 房间页按 `gameId / modeId` 展示
- 对局页按注册表装载斗地主实现

## 落地顺序

1. 建立平台通用类型与注册表
2. 将斗地主规则迁入 `games/doudizhu`
3. 重写服务端 `MatchEngine` 与房间配置模型
4. 重构 Socket 协议
5. 重构前端房间页和对局装载流
6. 删除旧 `wildcard: boolean`、旧 `GameManager` 直连逻辑和旧事件字段

## 风险与约束

### 1. 规则回归风险

斗地主赖子规则已覆盖大量边界场景，重构过程中必须优先迁移测试，再迁移实现。

### 2. 类型迁移风险

shared 层是 server 与 client 的共同边界，任何临时过渡字段都会快速扩散到全仓。必须避免“双模型长期共存”。

### 3. 通信切换风险

本次不保留兼容层意味着 client/server 需要成组重构，实施顺序必须从 shared 开始，保证类型先收敛。

## 最终状态

重构完成后，系统虽然仍只提供斗地主，但架构含义已经改变：

- 平台有明确的游戏注册入口
- 模式是游戏内定义，而不是全局布尔开关
- 服务端对局推进不再绑定斗地主专属概念
- 客户端可按游戏定义加载页面与交互

这为后续引入新的游戏提供了真实边界，而不是继续在斗地主代码上叠加分支。

## 当前落地状态

截至 2026 年 3 月 11 日，本次平台化重构已经落地到可运行代码，当前状态如下：

- 房间与对局入口已经统一为 `gameId + modeId + config`
- server 侧已经通过平台注册表与 `MatchEngine` 驱动对局创建和动作分发
- client 侧已经通过 `GameShell` 与前端注册表按 `gameId` 装载具体游戏实现
- 通信协议已经统一收敛到 `match:ready`、`match:action`、`match:requestSync` 与 `match:syncState`
- `@blitzlord/shared` 根出口已经收窄为平台无关内容，斗地主实现改由 `@blitzlord/shared/games/doudizhu` 暴露
- 当前内置游戏仍只有 `doudizhu`，但已支持 `classic` 与 `wildcard` 两个模式共用同一套平台骨架

这意味着本次重构的验收目标已经满足：系统边界从“带赖子开关的斗地主项目”切换成了“已内置一个游戏、可继续扩展更多游戏的平台项目”。
