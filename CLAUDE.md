# Blitzlord - 联机斗地主

## 项目概述

多人在线斗地主 Web 应用。Monorepo 架构，三个包：shared（共享类型+规则引擎）、server（Node.js 后端）、client（React 前端）。

## 技术栈

- **Monorepo:** pnpm workspace
- **前端:** React 19 + TypeScript + Vite + Tailwind CSS 4 + React Router (hash mode) + Zustand
- **后端:** Node.js + Socket.IO + tsx
- **共享:** TypeScript 类型 + 斗地主规则引擎
- **测试:** Vitest
- **持久化:** 无（MVP 纯内存）

## 项目结构

```
packages/
├── shared/src/          # 前后端共享代码
│   ├── types/           # Card, Game, Room, Events 类型定义
│   ├── rules/           # 规则引擎（cardType, cardCompare, validator, scoring）
│   ├── constants/       # 牌面常量、FULL_DECK
│   ├── utils/           # deck, sort, cardEquals
│   └── __tests__/
├── server/src/          # 后端
│   ├── session/         # SessionManager（token→身份映射）
│   ├── room/            # Room + RoomManager
│   ├── game/            # GameManager（状态机）
│   ├── socket/          # createHandlers() 工厂函数
│   ├── index.ts         # 入口
│   └── __tests__/
└── client/src/          # 前端
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
pnpm dev:client          # 仅启动前端（端口 5173）
pnpm test                # 运行所有测试
pnpm test:shared         # 仅运行 shared 包测试
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

### Socket handlers

- **工厂函数 + 依赖注入**，非全局单例：`createHandlers({ roomManager, sessionManager, games })`
- 可测试、可替换依赖

### Room 封装

- 不直接修改属性，通过 `startPlaying()` / `finishGame()` / `resetReady()` / `backToWaiting()` 方法

## 编码规范

- 所有代码 TypeScript strict mode
- ESM（`"type": "module"`），导入路径带 `.js` 后缀
- 牌面比较一律用 `cardEquals()`，不要手写 `rank === && suit ===`
- 前端样式全部用 Tailwind CSS class，禁止内联 `style={{}}`
- 测试放在同包的 `__tests__/` 目录，文件名 `*.test.ts`
- 提交信息用 conventional commits 格式（`feat:` / `fix:` / `test:` 等）

## 设计文档

- 设计文档：`docs/plans/2026-03-02-doudizhu-design.md`
- 实施计划：`docs/plans/2026-03-02-doudizhu-implementation.md`
- 审核报告：`docs/plans/2026-03-02-design-review.md`
