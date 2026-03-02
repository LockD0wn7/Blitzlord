# Blitzlord - 联机斗地主

多人在线斗地主 Web 应用，支持实时对战、断线重连、标准叫分制和完整计分系统。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript + Vite + Tailwind CSS 4 |
| 路由 | React Router (hash mode) |
| 状态管理 | Zustand |
| 后端 | Node.js + Socket.IO |
| 共享逻辑 | TypeScript 类型 + 斗地主规则引擎 |
| 包管理 | pnpm workspace (Monorepo) |
| 测试 | Vitest |

## 项目结构

```
packages/
├── shared/          # 前后端共享代码
│   ├── types/       # Card, Game, Room, Events 类型定义
│   ├── rules/       # 规则引擎（牌型识别、比较、验证、计分）
│   ├── constants/   # 牌面常量
│   └── utils/       # 洗牌、排序、牌面比较工具
├── server/          # 后端服务
│   ├── session/     # 会话管理（token 身份映射）
│   ├── room/        # 房间管理
│   ├── game/        # 游戏状态机
│   └── socket/      # Socket.IO 事件处理
└── client/          # 前端应用
    ├── components/  # React 组件（大厅、房间、游戏界面）
    ├── store/       # Zustand 状态管理
    ├── socket/      # Socket.IO 客户端
    └── routes/      # 路由配置
```

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 8

### 安装与运行

```bash
# 安装依赖
pnpm install

# 同时启动前后端
pnpm dev

# 或分别启动
pnpm dev:server    # 后端 http://localhost:3001
pnpm dev:client    # 前端 http://localhost:5173
```

打开 3 个浏览器标签页访问 `http://localhost:5173`，输入不同昵称即可开始游戏。

### 运行测试

```bash
pnpm test            # 运行所有测试
pnpm test:shared     # 仅 shared 包测试
```

## 游戏规则

### 叫地主

- 标准叫分制（1/2/3 分），每人一次机会
- 叫 3 分封顶，直接成为地主
- 全不叫重发牌，最多 3 次，之后强制随机指定

### 出牌

支持全部标准牌型：单张、对子、三张、三带一/二、顺子、连对、飞机（带/不带）、炸弹、火箭、四带二

### 计分

```
最终得分 = 基础分(1) × 叫分倍率 × 2^炸弹数 × (火箭?2:1) × (春天?2:1)
```

- 地主赢：地主得 `分数×2`，农民各扣 `分数`
- 农民赢：农民各得 `分数`，地主扣 `分数×2`

## 特性

- **实时对战** — Socket.IO 双向通信，即时响应
- **断线重连** — 60 秒内重连恢复游戏状态，超时判负
- **Token 身份** — localStorage 持久化，刷新页面不丢失身份
- **完整规则引擎** — 14 种牌型识别，含四带二/飞机歧义处理
- **路由守卫** — Hash 路由，支持浏览器前进后退

## 许可证

MIT
