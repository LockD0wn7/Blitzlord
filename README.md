# Blitzlord

一个基于 `pnpm` monorepo 的三人联机斗地主项目，包含 React 19 + Vite 前端、Socket.IO 服务端，以及共享的牌型规则与类型定义。

## 当前功能

- 三人房间制联机对战，支持创建房间、加入房间、准备开局、离开房间
- 标准叫分流程，包含流局重发、强制指定地主、底牌发放
- 普通模式与赖子模式
- 建房时可直接选择赖子模式
- 房间内支持发起投票切换模式
- 地主确定后，赖子模式会随机指定一个点数作为赖子
- 完整牌型识别与比较
- 单张、对子、三张、三带一、三带二、顺子、连对、飞机、四带二、炸弹、火箭
- 赖子模式下支持赖子参与牌型识别、压牌校验与出牌提示
- 已出牌区域与记牌器历史会展示赖子变换后的牌面样式
- 记牌器、出牌提示、断线重连、同步状态恢复
- 本地持久化玩家身份，刷新页面后可沿用同一玩家 ID

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 19、TypeScript、Vite、Tailwind CSS 4 |
| 状态管理 | Zustand |
| 路由 | React Router |
| 后端 | Node.js、Socket.IO |
| 共享逻辑 | TypeScript、共享类型、斗地主规则引擎 |
| 测试 | Vitest |
| 包管理 | pnpm workspace |

## 目录结构

```text
packages/
  client/   前端应用
  server/   Socket.IO 服务端
  shared/   前后端共享类型、常量、规则与工具

docs/       项目说明与计划文档
.github/    CI / 工作流配置
render.yaml Render 部署配置
```

### `packages/client`

- `src/components`：大厅、房间、对局 UI
- `src/store`：Zustand 状态
- `src/socket`：Socket 客户端封装
- `src/routes`：路由入口

### `packages/server`

- `src/socket`：服务端事件处理
- `src/game`：游戏状态机
- `src/room`：房间管理
- `src/session`：玩家会话与重连

### `packages/shared`

- `src/types`：共享类型与事件定义
- `src/rules`：牌型识别、压牌校验、提示、计分
- `src/utils`：洗牌、发牌、排序、记牌器快照等工具
- `src/__tests__`：共享规则与工具测试

## 本地开发

### 环境要求

- Node.js `>=18`
- pnpm

### 安装依赖

```bash
pnpm install
```

### 启动开发环境

```bash
pnpm dev
```

分别启动前后端：

```bash
pnpm dev:client
pnpm dev:server
```

默认地址：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:3001`

## 测试与构建

运行全部测试：

```bash
pnpm test
```

只跑共享规则测试：

```bash
pnpm test:shared
```

按包运行测试：

```bash
pnpm --filter @blitzlord/client test
pnpm --filter @blitzlord/server test
pnpm --filter @blitzlord/shared test
```

构建：

```bash
pnpm build
```

## 配置项

服务端支持以下环境变量：

- `PORT`：服务端监听端口，默认 `3001`
- `CORS_ORIGIN`：允许访问的前端地址，默认 `http://localhost:5173`

## 规则说明

### 普通模式

- 按标准斗地主规则进行叫分、出牌与计分

### 赖子模式

- 地主确定后，从 `3` 到 `2` 中随机选择一个点数作为赖子
- 赖子可参与对子、三张、顺子、连对、飞机、炸弹等组合
- 提示系统、出牌校验、牌型比较都会基于当前 `wildcardRank` 处理

### 计分

- 基础分由叫分决定
- 炸弹、火箭、春天会继续放大分数
- 地主与农民按标准倍数结算

## 当前测试覆盖

- 共享规则层：牌型识别、压牌比较、赖子规则、提示、计分、记牌器工具
- 服务端：房间与游戏流程
- 前端：出牌提示状态、记牌器状态、Socket 客户端、赖子展示回归

## License

MIT
