# 赖子模式设计文档

## 概述

为斗地主增加赖子（万能牌）玩法。赖子模式作为可选游戏模式，通过房间投票切换。

## 赖子选定规则

- **时机**：叫分确定地主后揭晓
- **方式**：系统从 3~2 共 13 个普通点数中随机选一个作为 `wildcardRank`
- **效果**：该点数的所有 4 张牌都成为赖子
- **可见性**：所有玩家都能看到赖子点数

## 赖子能力

### 替代范围

- 可替代 3~2 的任意普通牌
- **不能**替代大小王，因此不能用赖子凑火箭

### 原始身份保留

- 赖子牌保留原始点数身份，玩家可以选择：
  - 当**普通牌**使用（按原始点数出牌）
  - 当**万能牌**使用（替代其他牌组成牌型）

### 顺子规则变更

- 赖子模式下，**2 可以加入顺子**
- 顺子范围从 3~A 扩展为 3~2
- 连对、飞机同理，2 也可参与连续序列

## 炸弹大小关系

```
火箭 > 纯赖子炸 > 硬炸(按点数) > 软炸(按点数) > 非炸弹牌型
```

| 类型 | 定义 | 说明 |
|------|------|------|
| 火箭 | 大小王 | 最大，不变 |
| 纯赖子炸 | 4 张赖子 | 仅次于火箭 |
| 硬炸 | 4 张相同自然牌（无赖子参与） | 按点数比较 |
| 软炸 | 赖子 + 自然牌凑成 4 张同点数 | 按点数比较，同点数小于硬炸 |

- 软炸和硬炸都计入 `bombCount`（影响计分倍率）
- 纯赖子炸也计入 `bombCount`

## 数据模型变更

### Room

```typescript
interface RoomSettings {
  wildcard: boolean;  // 是否启用赖子模式
}
```

### GameState

```typescript
// 新增字段
wildcardRank: Rank | null;  // 赖子点数，非赖子模式为 null
```

### CardPlay

```typescript
// 新增可选字段
interface CardPlay {
  // ...现有字段
  softBomb?: boolean;  // 是否为软炸
  pureWild?: boolean;  // 是否为纯赖子炸
}
```

## 规则引擎变更

### identifyCardType

```typescript
identifyCardType(cards: Card[], wildcardRank?: Rank | null): CardPlay | null
```

- 将牌分为"自然牌"和"赖子牌"两组
- 赖子作为万能牌，枚举所有可能的替代组合
- 4 张赖子 → pureWild 炸弹
- 赖子模式下 2 可参与顺子/连对/飞机

### canBeat

- 新增炸弹层级：火箭 > 纯赖子炸 > 硬炸 > 软炸
- 同层级内按点数比较

### validatePlay

```typescript
validatePlay(cards, hand, previousPlay?, wildcardRank?)
```

- 逻辑不变，透传 `wildcardRank` 给 `identifyCardType`

### getPlayableHints

```typescript
getPlayableHints(hand, previousPlay?, wildcardRank?)
```

- 枚举所有赖子参与的合法牌型组合，不剪枝
- 玩家通过提示轮换选择

### calculateScore

- 不改变计分公式
- 软炸、硬炸、纯赖子炸都计入 bombCount

## 模式切换机制

### 创建房间

- 创建者选择初始模式（普通/赖子），默认普通

### 投票切换

- 一局结束后（等待中状态），任意玩家可发起模式切换投票
- 3 人中 2 人同意即通过，下局生效
- 房间内所有玩家可看到当前模式和投票状态

## Socket 事件变更

| 事件 | 变更 |
|------|------|
| `room:create` | 携带 `wildcard: boolean` |
| `room:update` | 携带 `wildcard: boolean` |
| `room:voteMode` | **新增**，发起/响应模式切换投票 |
| `game:syncState` | `GameSnapshot` 增加 `wildcardRank` |

## 前端 UI 变更

### 房间

- 创建房间时增加"赖子模式"开关
- 房间列表/房间内显示当前模式标识
- 投票切换 UI（发起投票 + 同意/拒绝）

### 游戏内

- 确定地主后展示赖子点数公告
- 手牌中赖子牌有特殊视觉标记（边框高亮/角标）
- 赖子牌按原始点数排序，但有视觉区分
- CardTracker 显示对手剩余赖子数

## 边界情况

- 赖子点数只从 3~2 中选，不会选到大小王
- 春天判定不受赖子模式影响
- 叫分阶段赖子未揭晓，不影响叫分
- 断线重连时 `wildcardRank` 通过 `GameSnapshot` 同步
