# Shared 包规则引擎代码审查报告

**审查日期：** 2026-03-02
**审查范围：** `packages/shared/src/rules/` 全部实现 + `packages/shared/src/__tests__/` 对应测试
**审查基准：** `fd34d02` (feat: 搭建 monorepo 脚手架并实现共享包核心功能)

## 概览

| 模块 | 文件 | 行数 | 测试数 | 状态 |
|------|------|------|--------|------|
| 牌型识别 | `rules/cardType.ts` | 203 行 | 27 | 有 Bug |
| 牌型比较 | `rules/cardCompare.ts` | 33 行 | 18 | 通过 |
| 出牌验证 | `rules/validator.ts` | 55 行 | 11 | 通过 |
| 计分系统 | `rules/scoring.ts` | 41 行 | 13 | 通过 |
| barrel 导出 | `rules/index.ts` | 5 行 | — | 通过 |
| 入口重导出 | `src/index.ts` (+1 行) | — | — | 通过 |

**测试结果：** 87 个测试全部通过（含此前已有的 cardEquals / deck / sort 测试）

**整体评价：** 代码质量高，架构清晰，模块职责分离到位。发现 1 个阻塞性逻辑 Bug，建议修复后合入。

---

## 🔴 Blocking（必须修复）

### 1. 飞机带单：同 rank 翅膀被误判为无效牌型

**文件：** `packages/shared/src/rules/cardType.ts` 第 181 行

**问题��述：**

飞机带单的判定条件中使用了 `pairs.length === 0`：

```typescript
// 飞机带单：带等量单张
if (remaining === tripleCount && pairs.length === 0) {
```

当飞机的两张翅膀恰好是同 rank 不同花色时（如 888 999 + 3♠3♥），`countRanks` 将两张 3 统计为出现 2 次，`groupByCount` 将其归类为一对（`pairs=[3]`）。此时 `pairs.length === 0` 不满足，飞机带单条件失败。而飞机带对需要 `remaining === tripleCount * 2`（2 ≠ 4），也不满足。最终函数返回 `null`，将合法牌型判定为无效。

**重现路径：**

```typescript
// 888 + 999 + 3♠ + 3♥ → 预期 TripleStraightWithOnes，实际返回 null
const cards = [
  { rank: Rank.Eight, suit: Suit.Spade },
  { rank: Rank.Eight, suit: Suit.Heart },
  { rank: Rank.Eight, suit: Suit.Diamond },
  { rank: Rank.Nine, suit: Suit.Spade },
  { rank: Rank.Nine, suit: Suit.Heart },
  { rank: Rank.Nine, suit: Suit.Diamond },
  { rank: Rank.Three, suit: Suit.Spade },
  { rank: Rank.Three, suit: Suit.Heart },
];
identifyCardType(cards); // → null ✗（应为 TripleStraightWithOnes）
```

**影响：** 在标准斗地主规则中（QQ斗地主等主流实现均如此），飞机带单的翅膀可以是同 rank 不同花色。此 Bug 会导致玩家合法出牌被拒绝。

**修复方案：**

移除 `pairs.length === 0` 检查：

```typescript
// 修复前
if (remaining === tripleCount && pairs.length === 0) {
// 修复后
if (remaining === tripleCount) {
```

**安全性分析：** 此修改不会引入歧义：
- 飞机带单：`remaining === tripleCount`
- 飞机带对：`remaining === tripleCount * 2`
- 两个条件互斥，飞机带对的判定不受影响
- 四带二系列在飞机之前判定（`quads.length === 1`），不受影响

---

## 💡 Suggestions（建议改进）

### 2. 补充飞机带单同 rank 翅膀的测试用例

**文件：** `packages/shared/src/__tests__/cardType.test.ts`

修复 Bug #1 后应添加对应测试：

```typescript
it("飞机带单：翅膀为同 rank 不同花色", () => {
  const cards = [
    c(Rank.Eight, Suit.Spade), c(Rank.Eight, Suit.Heart), c(Rank.Eight, Suit.Diamond),
    c(Rank.Nine, Suit.Spade), c(Rank.Nine, Suit.Heart), c(Rank.Nine, Suit.Diamond),
    c(Rank.Three, Suit.Spade), c(Rank.Three, Suit.Heart),
  ];
  const result = identifyCardType(cards);
  expect(result).not.toBeNull();
  expect(result!.type).toBe(CardType.TripleStraightWithOnes);
  expect(result!.mainRank).toBe(Rank.Eight);
  expect(result!.length).toBe(2);
});
```

### 3. 补充 3 组以上飞机的测试覆盖

当前飞机测试仅覆盖 2 组（最小合法值）。建议补充 3 组飞机测试以验证更长连续序列：

```typescript
it("识别 3 组飞机不带", () => {
  const cards = [
    c(Rank.Seven, Suit.Spade), c(Rank.Seven, Suit.Heart), c(Rank.Seven, Suit.Diamond),
    c(Rank.Eight, Suit.Spade), c(Rank.Eight, Suit.Heart), c(Rank.Eight, Suit.Diamond),
    c(Rank.Nine, Suit.Spade), c(Rank.Nine, Suit.Heart), c(Rank.Nine, Suit.Diamond),
  ];
  const result = identifyCardType(cards);
  expect(result).not.toBeNull();
  expect(result!.type).toBe(CardType.TripleStraight);
  expect(result!.length).toBe(3);
});
```

### 4. 补充四带二单中两张同 rank 的测试

当前代码**正确**处理了此情况（条件不检查 `pairs`），但缺少对应测试用例显式验证：

```typescript
it("四带二单：两张附带牌为同 rank 不同花色", () => {
  const cards = [
    c(Rank.Ace, Suit.Spade), c(Rank.Ace, Suit.Heart),
    c(Rank.Ace, Suit.Diamond), c(Rank.Ace, Suit.Club),
    c(Rank.Three, Suit.Spade), c(Rank.Three, Suit.Heart),
  ];
  const result = identifyCardType(cards);
  expect(result).not.toBeNull();
  expect(result!.type).toBe(CardType.QuadWithTwo);
  expect(result!.mainRank).toBe(Rank.Ace);
});
```

### 5. `canBeat` 补充相同 rank 炸弹不能互打的测试

当前逻辑正确（`>` 严格大于），但缺少显式测试：

```typescript
it("相同 rank 炸弹不能互打", () => {
  expect(canBeat(
    play(CardType.Bomb, Rank.Seven),
    play(CardType.Bomb, Rank.Seven),
  )).toBe(false);
});
```

---

## 🟢 Nit（小建议）

### 6. `scoring.ts` 注释可补充基础分说明

**文件：** `packages/shared/src/rules/scoring.ts` 第 1-5 行

当前注释为 `baseBid × 2^bombCount × ...`，CLAUDE.md 中的公式为 `基础分(1) × 叫分倍率 × 2^炸弹数 × ...`。两者等价（基础分固定为 1 被隐含），但注释中可补充说明"基础分固定为 1，已隐含"以避免歧义。

---

## ❓ Questions（待确认）

### 7. `isSpring` 边界条件

`isSpring(1, [0, 0])` 会返回 `true`（同时满足地主春天和反春天的条件）。虽然实际游戏中地主不可能 1 手出完 20 张牌，但建议确认后续 `GameManager` 的调用逻辑是否对此做了防护，避免理论上的边界问题。

---

## 🎉 Praise（做得好的地方）

| 亮点 | 说明 |
|------|------|
| **模块职责清晰** | cardType（识别）→ cardCompare（比较）→ validator（验证）→ scoring（计分），单向依赖链 |
| **四带二优先于飞机** | 正确处理了 8 张牌中"4 张相同 + 2 对"的歧义，优先判定为四带两对 |
| **`countRanks` + `groupByCount` 抽象** | 将牌面统计和分组抽取为内部辅助函数，`identifyCardType` 主体清晰可读 |
| **`isConsecutive` 通用化** | 适用于顺子、连对、飞机三种牌型，避免重复逻辑 |
| **`canBeat` 判定链简洁** | 火箭 → 炸弹 → 同类型 → 长度 → mainRank，层层短路，逻辑无冗余 |
| **`validatePlay` 三步验证** | 手牌归属 → 牌型识别 → 比较上家，流程符合真实出牌逻辑 |
| **使用 `cardEquals` 做牌面比较** | 严格遵守 CLAUDE.md 规范，未手写 `rank === && suit ===` |
| **Rank 数值枚举直接比较** | `mainRank > previous.mainRank` 利用枚举值递增特性，简洁正确 |
| **`calculateScore` 参数用字面量类型** | `baseBid: 1 \| 2 \| 3` 编译期限制范围，防止传入非法值 |
| **测试命名清晰** | 中文测试描述直接映射斗地主术语，可读性极高 |
| **歧义测试独立 `describe` 块** | 四带二 vs 飞机的歧义用例单独分组，意图明确 |
| **无效牌型覆盖全面** | 不足 5 张顺子、含 2/王顺子、非连续连对/飞机、三带两单等均有测试 |
| **`validator.test.ts` 重复牌检测** | 显式测试了"同一张牌出两次"的防护逻辑 |
| **barrel 导出区分 value/type** | `export type { ValidateResult }` 符合 `isolatedModules` 最佳实践 |

---

## 统计汇总

| 严重程度 | 数量 |
|----------|------|
| 🔴 Blocking | 1 |
| 💡 Suggestion | 4 |
| 🟢 Nit | 1 |
| ❓ Question | 1 |
| 🎉 Praise | 14 |

---

## 结论

🔄 **Request Changes** — 修复飞机带单的 Bug（#1）并补充对应测试（#2）后即可通过审查。其余建议为可选改进。

---

## 修复总结

**修复日期：** 2026-03-02

| # | 类型 | 状态 | 处理方式 |
|---|------|------|----------|
| #1 🔴 | 飞机带单同 rank 翅膀误判 | ✅ 已修复 | `cardType.ts`: 移除飞机带单条件中的 `pairs.length === 0` |
| #2 💡 | 补充飞机带单同 rank 翅膀测试 | ✅ 已补充 | `cardType.test.ts`: 新增 "飞机带单：翅膀为同 rank 不同花色" 用例 |
| #3 💡 | 补充 3 组飞机测试 | ✅ 已补充 | `cardType.test.ts`: 新增 "识别 3 组飞机不带" 用例 |
| #4 💡 | 补充四带二单同 rank 测试 | ✅ 已补充 | `cardType.test.ts`: 新增 "四带二单：两张附带牌为同 rank 不同花色" 用例 |
| #5 💡 | 补充相同 rank 炸弹测试 | ✅ 已补充 | `cardCompare.test.ts`: 新增 "相同 rank 炸弹不能互打" 用例 |
| #6 🟢 | scoring.ts 注释补充 | ✅ 已补充 | `scoring.ts`: 注释中补充 "基础分固定为 1，已隐含" |
| #7 ❓ | `isSpring(1, [0, 0])` 边界 | 📌 后续处理 | 实际游戏不会发生，后续 GameManager 实现时确保调用前置条件 |

**修复后测试：** 7 个测试文件，91 个测试全部通过。
