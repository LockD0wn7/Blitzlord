# Blitzlord 全项目代码审查报告

**审查日期：** 2026-03-02
**审查范围：** 所有未提交代码（shared、server、client 三个包 + 项目配置）

## 概览

| 包 | 文件数 | 总行数 | 状态 |
|---|--------|--------|------|
| **shared** | 16 个 .ts 文件 | ~380 行 | 类型 + 常量 + 工具函数 + 测试，已实现 |
| **server** | 1 个 .ts 文件 | 22 行 | 最小脚手架 |
| **client** | 3 个源文件 | ~25 行 | Vite + React + Tailwind 脚手架 |
| **配置** | 8 个配置文件 | — | Monorepo 基础设施 |

**整体评价：代码质量很高。** shared 包的类型设计严谨、工具函数正确、测试覆盖合理。server/client 的脚手架干净简洁。工程化配置现代且一致。

---

## 🔴 Blocking（必须修复）

### 1. `pnpm test` 只运行 shared 包测试

**文件：** `package.json`（根级）第 9 行

当前 `"test": "pnpm --filter @blitzlord/shared test"` 与 `test:shared` 完全重复，server 包测试不会被执行，与 CLAUDE.md 中 "`pnpm test` 运行所有测试" 的描述矛盾。

**修复：** 改为 `"test": "pnpm -r test"`

---

## 🟡 Important（应该修复）

### 2. `game:pass` 缺少 error callback

**文件：** `packages/shared/src/types/events.ts` 第 32 行

`game:playCards` 有 `{ ok, error }` callback，但 `game:pass` 和 `game:callLandlord` 没有，无法精确反馈错误（如非当前回合 pass）。

**建议：** 统一添加 callback：

```typescript
"game:pass": (callback: (res: { ok: boolean; error?: string }) => void) => void;
"game:callLandlord": (data: { bid: 0 | 1 | 2 | 3 }, callback: (res: { ok: boolean; error?: string }) => void) => void;
```

### 3. `dealCards` 测试缺少"牌不重叠"验证

**文件：** `packages/shared/src/__tests__/deck.test.ts`

当前只验证了每手牌张数，未验证三手牌 + 底牌之间无重复。

**建议：** 添加测试用例：

```typescript
it("四组牌之间不应有重复", () => {
  const deck = createDeck();
  const [h1, h2, h3, bottom] = dealCards(deck);
  const allCards = [...h1, ...h2, ...h3, ...bottom];
  const keys = allCards.map(c => `${c.rank}:${c.suit}`);
  const unique = new Set(keys);
  expect(unique.size).toBe(54);
});
```

### 4. `build` 脚本引用了 shared 的 build，但 shared 没有 build 脚本

**文件：** `package.json`（根级）第 11 行

运行 `pnpm build` 会失败。

**修复方案 A：** 简化根级 build 为 `"build": "pnpm --parallel -r build"`
**修复方案 B：** 给 shared 添加 `"build": "tsc"` 脚本

考虑到 shared 的 `exports` 直接指向 `./src/index.ts`（源码模式），方案 A 更合理。

### 5. server 缺少 `@types/node`

**文件：** `packages/server/package.json`

server 使用了 `import { createServer } from "http"`，没有 `@types/node` 会导致 IDE 类型提示和 tsc 检查出问题。

**修复：** devDependencies 添加 `"@types/node": "^22.0.0"`

### 6. client 缺少 `vite/client` 类型引用

**文件：** `packages/client/tsconfig.json`

需要添加 `src/vite-env.d.ts`，否则使用 `import.meta.env` 或静态资源导入时会报类型错误。

**修复：** 创建 `packages/client/src/vite-env.d.ts`：

```typescript
/// <reference types="vite/client" />
```

### 7. client 缺少 Socket.IO 代理配置

**文件：** `packages/client/vite.config.ts`

开发时 client(5173) 与 server(3001) 跨端口，建议添加 proxy 简化客户端连接逻辑。

**建议：**

```typescript
server: {
  port: 5173,
  proxy: {
    "/socket.io": {
      target: "http://localhost:3001",
      ws: true,
    },
  },
},
```

---

## 🟢 Nit（小建议）

### 8. `GameSnapshot` 缺少 `rocketUsed` 字段

**文件：** `packages/shared/src/types/game.ts`

`GameState` 有 `rocketUsed: boolean`，但 `GameSnapshot` 没有。客户端无法直接展示当前倍率。

### 9. `FULL_DECK` 的 `Object.freeze` 只是浅冻结

**文件：** `packages/shared/src/constants/card.ts` 第 51 行

数组内的 Card 对象仍可被修改。风险极低，因为 `createDeck()` 会 clone 每张牌。

### 10. `sortCards` 的 `localeCompare` 可能在不同 locale 下排序不一致

**文件：** `packages/shared/src/utils/sort.ts` 第 11 行

可指定 locale（如 `localeCompare(b.suit!, 'en')`）或用显式映射。对游戏逻辑无实际影响（只影响同 rank 牌的花色显示顺序）。

### 11. 缺少 rank 相同但 suit 不同的排序测试

**文件：** `packages/shared/src/__tests__/sort.test.ts`

`sortCards` 的次级排序条件（suit localeCompare）没有被测试覆盖。

### 12. server 的 PORT 和 CORS origin 硬编码

**文件：** `packages/server/src/index.ts` 第 7、19 行

后续 Task 12 重写时应提取为环境变量。

### 13. server 缺少错误处理和优雅关闭

**文件：** `packages/server/src/index.ts`

- 缺少 `httpServer.listen` 的 `EADDRINUSE` 错误处理
- 缺少 `SIGINT` / `SIGTERM` 优雅关闭

后续 Task 12 重写时应添加。

### 14. server tsconfig 缺少对测试文件的 exclude

**文件：** `packages/server/tsconfig.json`

测试文件会被编译到 dist/。Task 8 添加测试时应配置 exclude。

### 15. client 缺少 favicon

**文件：** `packages/client/index.html`

浏览器会对 `/favicon.ico` 产生 404 请求。

### 16. 根级 package.json 缺少 `packageManager` 字段

**文件：** `package.json`（根级）

建议添加 `"packageManager": "pnpm@10.x.x"` 以通过 corepack 管理版本一致性。

---

## 🎉 Praise（做得好的地方）

| 亮点 | 说明 |
|------|------|
| **Rank 枚举数值编码** | 从 3 递增到 17，使排序和比较可直接用数值运算，避免查找表 |
| **GameSnapshot 信息隔离** | 自己的 `myHand: Card[]` vs 其他人只能看到 `cardCount`，安全意识好 |
| **GameState.baseBid 字面量联合类型** | `1 \| 2 \| 3` 比 `number` 安全得多，编译期检查范围 |
| **Socket.IO 类型化事件定义** | `ClientEvents` / `ServerEvents` 完整匹配设计文档 |
| **FULL_DECK 不可变 + clone** | `Object.freeze` + `createDeck` 的 `map(card => ({...card}))` 双重保护 |
| **Fisher-Yates 洗牌算法** | 经典正确实现，且不修改原数组 |
| **sortCards 不可变** | `[...cards].sort()` 保持函数式不可变性 |
| **barrel exports 区分 value/type** | 符合 `isolatedModules` 最佳实践 |
| **ESM `.js` 后缀全面遵守** | 所有导入路径都带 `.js` 后缀，严格遵循项目规范 |
| **所有包 ESM 配置统一** | 四个 `package.json` 都设置了 `"type": "module"` |
| **TypeScript strict 全面启用** | base config 的 `strict: true` 被所有包正确继承 |
| **CORS origin 不用通配符** | server 指定了 `http://localhost:5173`，而非 `*` |
| **workspace 依赖引用正确** | `"@blitzlord/shared": "workspace:*"` 标准做法 |
| **shared 包源码直接导出** | `exports` 指向 `./src/index.ts`，开发时无需先 build |
| **Tailwind CSS 4 集成正确** | `@tailwindcss/vite` 插件 + `@import "tailwindcss"` |
| **依赖版本一致** | TypeScript `^5.7.0`、Vitest `^3.0.0`、Socket.IO `^4.8.0` 全包一致 |
| **17 个测试全部通过** | shared 包的 cardEquals、deck、sort 测试覆盖了核心场景 |

---

## 统计汇总

| 严重程度 | 数量 |
|----------|------|
| 🔴 Blocking | 1 |
| 🟡 Important | 6 |
| 🟢 Nit | 9 |
| 🎉 Praise | 17 |

---

## 优先修复建议

**立即可修（5 分钟内）：**

1. 根级 `package.json` 的 `test` 脚本改为 `pnpm -r test`
2. 根级 `package.json` 的 `build` 脚本修复
3. `server/package.json` 添加 `@types/node`
4. `client/src/vite-env.d.ts` 添加 Vite 类型引用

**下一步开发前应修的：**

5. `game:pass` / `game:callLandlord` 添加 error callback
6. `dealCards` 测试补充不重叠验证
