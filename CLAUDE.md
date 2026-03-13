# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Blitzlord - 联机斗地主

## 项目概述

多人在线斗地主 Web 应用。Monorepo 架构，三个包：shared（共享类型+规则引擎）、server（Node.js 后端）、client（React 前端）。

## 技术栈

- **Monorepo:** pnpm workspace（包名 `@blitzlord/*`）
- **前端:** React 19 + TypeScript + Vite + Tailwind CSS 4 + React Router (hash mode) + Zustand
- **后端:** Node.js + Socket.IO + tsx
- **共享:** TypeScript 类型 + 斗地主规则引擎
- **测试:** Vitest（各包默认配置，无自定义 vitest.config）
- **持久化:** 无（MVP 纯内存）
- **部署:** Client → GitHub Pages，Server → Render.com

## 项目结构

```
packages/
├── shared/src/          # 前后端共享代码
│   ├── types/           # Card, Game, Room, Events 类型定义
│   ├── platform/        # 可插拔游戏平台层（GameRegistry, GameDefinition, ModeDefinition）
│   ├── games/doudizhu/  # 斗地主游戏定义、规则、模式（classic/wildcard）
│   ├── constants/       # 牌面常量、FULL_DECK
│   ├── utils/           # deck, sort, cardEquals
│   └── __tests__/
├── server/src/          # 后端
│   ├── session/         # SessionManager（token→身份映射）
│   ├── room/            # Room + RoomManager
│   ├── platform/        # MatchEngine, actionHandlers, 服务端游戏注册
│   ├── games/doudizhu/  # DoudizhuMatchRuntime
│   ├── bot/             # BotController（AI 出牌逻辑）
│   ├── socket/          # createHandlers() 工厂函数
│   ├── index.ts         # 入口
│   └── __tests__/
└── client/src/          # 前端
    ├── platform/        # 前端游戏外壳与注册
    ├── games/doudizhu/  # 斗地主专属视图和 store
    ├── components/      # Lobby/, Room/, Game/, shared/
    ├── store/           # useGameStore, useRoomStore, useSocketStore
    ├── socket/          # Socket.IO 客户端封装
    ├── routes/          # React Router 配置
    └── App.tsx
```

## 常用命令

```bash
pnpm install             # 安装依赖
pnpm dev                 # 同时启动前后端
pnpm dev:server          # 仅启动后端（端口 3001）
pnpm dev:client          # 仅启动前端（端口 5173，自动代理 /socket.io → 3001）
pnpm test                # 运行所有测试
pnpm test:shared         # 仅运行 shared 包测试

# 运行单个测试文件
cd packages/shared && npx vitest run src/__tests__/cardType.test.ts
# 或使用 watch 模式
cd packages/shared && npx vitest src/__tests__/cardType.test.ts

# 构建
pnpm build               # 构建所有包
```

## 核心设计决策

### 身份系统

- **不用 `socket.id`**，用 `localStorage` 中的 UUID token
- Socket.IO 连接通过 `auth: { token }` 传递身份
- 服务端 `SessionManager` 维护 `token → PlayerSession` 映射

### 断线重连

- 断线保留座位 60 秒，重连后推送 `game:syncState` 完整快照
- 超时判负。**主动 `room:leave` = 立即判负**（不等 60 秒）

### 叫地主

- 标准叫分制（1/2/3 分），每人仅一次机会，叫 3 分封顶
- 全不叫重发牌，最多 3 次，之后强制随机指定地主

### 计分

```
最终得分 = 基础分(1) × 叫分倍率 × 2^炸弹数 × (火箭?2:1) × (春天?2:1)
```

### 可插拔游戏平台架构

- `shared/src/platform/` 定义 `GameDefinition`、`ModeDefinition`、`GameRegistry` 接口
- 游戏通过 `registerGame()` 注册，目前仅实现斗地主（`games/doudizhu/`）
- 每个游戏有自己的 `MatchRuntime`（服务端）和视图层（客户端）
- 操作通过 `dispatchMatchAction()` 统一分发到 `actionHandlers`

### Socket handlers

- **工厂函数 + 依赖注入**，非全局单例：`createHandlers({ roomManager, sessionManager, games })`
- 可测试、可替换依赖
- Socket.IO 事件类型在 `shared/src/types/events.ts` 中以 `ClientEvents` / `ServerEvents` 接口定义

### Room 封装

- 不直接修改属性，通过 `startPlaying()` / `finishGame()` / `resetReady()` / `backToWaiting()` 方法

### Bot 系统

- 玩家类型 `PlayerType: "human" | "bot"`，通过 `room:addBot` / `room:removeBot` 事件管理
- `BotController`（服务端）根据 `GamePhase` 决定行为：叫分阶段随机叫分，出牌阶段使用 `getPlayableHints()` 选择出牌
- Bot 操作有 600-1200ms 随机延迟模拟真人

## 编码规范

- TypeScript strict mode，基础配置在 `tsconfig.base.json`（target ES2022, module ESNext）
- ESM（`"type": "module"`），导入路径带 `.js` 后缀
- 牌面比较一律用 `cardEquals()`，不要手写 `rank === && suit ===`
- 前端样式全部用 Tailwind CSS class，禁止内联 `style={{}}`
- 测试放在同包的 `__tests__/` 目录，文件名 `*.test.ts`
- 提交信息用 conventional commits 格式（`feat:` / `fix:` / `test:` 等）

## 文档规范

### 设计文档

- 设计文档：`docs/plans/2026-03-02-doudizhu-design.md`
- 实施计划：`docs/plans/2026-03-02-doudizhu-implementation.md`
- 审核报告：`docs/plans/2026-03-02-design-review.md`

### Code Review 文档

- 目录：`docs/code-review/`
- 文件名格式：`YYYY-MM-DD-<主要功能点>.md`（如 `2026-03-02-rules-engine.md`）
- 修复完成后，将修复总结追加在文档末尾
