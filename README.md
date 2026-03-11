# Blitzlord

一个基于 `pnpm` monorepo 的多人回合制卡牌游戏平台。

当前内置游戏：
- `doudizhu`

当前内置模式：
- `classic`
- `wildcard`

## 当前状态

项目已经完成平台化重构，房间和对局都由 `gameId + modeId + config` 驱动。

- 平台层负责游戏注册、房间选择、对局装载、统一 Socket 协议
- 游戏层负责规则、模式差异、状态快照和前端视图
- 当前只有斗地主接入平台，但架构已经不再局限于斗地主

## 当前功能

- 三人房间联机对战，支持创建房间、加入房间、准备开局、离开房间
- 建房时选择 `gameId + modeId`
- 房间内支持发起配置投票并切换模式
- 对局动作统一走 `match:action`
- 对局状态统一走 `match:syncState`
- 支持断线重连和状态恢复
- 斗地主支持普通模式与赖子模式
- 斗地主支持记牌器、出牌提示、结算展示

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 19、TypeScript、Vite、Tailwind CSS 4 |
| 状态管理 | Zustand |
| 路由 | React Router |
| 后端 | Node.js、Socket.IO |
| 共享层 | TypeScript、平台抽象、游戏命名空间规则 |
| 测试 | Vitest |
| 包管理 | pnpm workspace |

## 目录结构

```text
packages/
  client/
    src/platform/          前端游戏平台壳与游戏注册表
    src/games/doudizhu/    斗地主前端实现
    src/components/        通用页面与游戏组件
    src/socket/            Socket 客户端封装
    src/routes/            路由入口

  server/
    src/platform/          MatchEngine、服务端注册表
    src/games/doudizhu/    斗地主服务端运行时
    src/room/              房间与配置投票
    src/session/           玩家会话与重连
    src/socket/            Socket 事件处理

  shared/
    src/platform/          平台类型、注册表、规则接口
    src/games/doudizhu/    斗地主类型、模式、规则导出
    src/types/             平台公共类型
    src/constants/         常量
    src/utils/             工具函数

docs/                      设计与实施文档
.github/                   CI 配置
render.yaml                部署配置
```

## 本地开发

环境要求：
- Node.js `>=18`
- pnpm

安装依赖：

```bash
pnpm install
```

启动开发环境：

```bash
pnpm dev
```

分别启动前后端：

```bash
pnpm dev:client
pnpm dev:server
```

前端默认运行在 `http://localhost:5173`，后端默认运行在 `http://localhost:3001`。

## 测试与构建

运行全部测试：

```bash
pnpm test
```

只运行共享规则测试：

```bash
pnpm test:shared
```

构建全部包：

```bash
pnpm build
```

## 后续扩展方向

- 接入第二个非斗地主游戏
- 为不同游戏提供独立的前端 MatchView
- 继续收紧平台根导出，减少游戏私有实现泄漏到共享入口

## License

MIT
