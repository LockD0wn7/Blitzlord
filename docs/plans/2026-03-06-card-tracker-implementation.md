# Card Tracker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 Blitzlord 增加一个仅当前玩家可见、支持重连恢复的记牌器，展示对手可能剩余点数和逐手出牌历史。

**Architecture:** 服务端只保存公共出牌事实，shared 中的纯函数根据“公共历史 + 当前玩家手牌”生成个人记牌快照，客户端通过 `game:syncState` 全量恢复并通过现有对局事件做增量更新。前端 UI 保持浮层化，不改变现有牌桌主布局；在前端组件编码时必须显式使用 `frontend-design` 技能。

**Tech Stack:** TypeScript, React 19, Zustand, Socket.IO, Tailwind CSS 4, Vitest, pnpm workspace

---

### Task 1: Shared Tracker Types And Pure Helper

**Files:**
- Create: `packages/shared/src/utils/cardTracker.ts`
- Create: `packages/shared/src/__tests__/cardTracker.test.ts`
- Modify: `packages/shared/src/types/game.ts`
- Modify: `packages/shared/src/utils/index.ts`
- Modify: `packages/shared/src/index.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { Rank, Suit, type Card } from "../types/card.js";
import { buildCardTrackerSnapshot } from "../utils/cardTracker.js";

function card(rank: Rank, suit: Suit | null): Card {
  return { rank, suit };
}

describe("buildCardTrackerSnapshot", () => {
  it("computes remaining opponent copies from my hand plus public history", () => {
    const snapshot = buildCardTrackerSnapshot({
      myHand: [
        card(Rank.Ace, Suit.Spade),
        card(Rank.Ace, Suit.Heart),
        card(Rank.BlackJoker, null),
      ],
      history: [
        {
          sequence: 1,
          round: 1,
          playerId: "p2",
          action: "play",
          cards: [card(Rank.Ace, Suit.Diamond)],
        },
        {
          sequence: 2,
          round: 1,
          playerId: "p3",
          action: "pass",
          cards: [],
        },
      ],
    });

    expect(snapshot.history).toHaveLength(2);
    expect(
      snapshot.remainingByRank.find((entry) => entry.rank === Rank.Ace)
        ?.remainingOpponentCopies,
    ).toBe(1);
    expect(
      snapshot.remainingByRank.find((entry) => entry.rank === Rank.BlackJoker)
        ?.remainingOpponentCopies,
    ).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @blitzlord/shared test -- src/__tests__/cardTracker.test.ts`

Expected: FAIL with module/type errors because `buildCardTrackerSnapshot` and tracker types do not exist yet.

**Step 3: Write minimal implementation**

```ts
const rankTotals = new Map<Rank, number>([
  [Rank.RedJoker, 1],
  [Rank.BlackJoker, 1],
  [Rank.Two, 4],
  [Rank.Ace, 4],
]);

export function buildCardTrackerSnapshot(params: {
  myHand: Card[];
  history: TrackerHistoryEntry[];
}): CardTrackerSnapshot {
  const handCounts = countByRank(params.myHand);
  const playedCounts = countByRank(
    params.history.flatMap((entry) => entry.action === "play" ? entry.cards : []),
  );

  return {
    history: params.history,
    remainingByRank: TRACKER_RANK_ORDER.map((rank) => ({
      rank,
      totalCopies: rankTotals.get(rank) ?? 4,
      playedCopies: playedCounts.get(rank) ?? 0,
      myCopies: handCounts.get(rank) ?? 0,
      remainingOpponentCopies:
        (rankTotals.get(rank) ?? 4) -
        (playedCounts.get(rank) ?? 0) -
        (handCounts.get(rank) ?? 0),
    })),
  };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @blitzlord/shared test -- src/__tests__/cardTracker.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/shared/src/utils/cardTracker.ts packages/shared/src/__tests__/cardTracker.test.ts packages/shared/src/types/game.ts packages/shared/src/utils/index.ts packages/shared/src/index.ts
git commit -m "feat(shared): add card tracker snapshot helper"
```

### Task 2: Server Tracker History And Sync Snapshot

**Files:**
- Modify: `packages/server/src/game/GameManager.ts`
- Modify: `packages/server/src/__tests__/game.test.ts`

**Step 1: Write the failing test**

```ts
it("includes tracker history and remaining counts in getFullState", () => {
  const gm = createGame();
  const landlord = setupPlaying(gm);
  const firstCard = gm.getPlayerHand(landlord).at(-1)!;

  gm.playCards(landlord, [firstCard]);
  gm.pass(gm.currentTurn!);

  const snapshot = gm.getFullState(landlord);

  expect(snapshot.tracker.history).toHaveLength(2);
  expect(snapshot.tracker.history[0]).toMatchObject({
    sequence: 1,
    playerId: landlord,
    action: "play",
  });
  expect(snapshot.tracker.history[1]).toMatchObject({
    sequence: 2,
    action: "pass",
  });
  expect(snapshot.tracker.remainingByRank.length).toBeGreaterThan(0);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @blitzlord/server test -- src/__tests__/game.test.ts`

Expected: FAIL because `GameSnapshot` has no `tracker` field and `GameManager` does not record history.

**Step 3: Write minimal implementation**

```ts
private trackerHistory: TrackerHistoryEntry[] = [];
private trackerSequence = 0;
private trackerRound = 1;

private pushTrackerEntry(entry: Omit<TrackerHistoryEntry, "sequence" | "round">) {
  this.trackerSequence += 1;
  this.trackerHistory.push({
    sequence: this.trackerSequence,
    round: this.trackerRound,
    ...entry,
  });
}

// in playCards success branch
this.pushTrackerEntry({ playerId, action: "play", cards: [...cards] });

// in pass success branch
this.pushTrackerEntry({ playerId, action: "pass", cards: [] });

// when round resets after two passes
this.trackerRound += 1;

// in deal/reset
this.trackerHistory = [];
this.trackerSequence = 0;
this.trackerRound = 1;

// in getFullState
tracker: buildCardTrackerSnapshot({
  myHand: me ? [...me.hand] : [],
  history: this.trackerHistory.map((entry) => ({
    ...entry,
    cards: [...entry.cards],
  })),
}),
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @blitzlord/server test -- src/__tests__/game.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/game/GameManager.ts packages/server/src/__tests__/game.test.ts
git commit -m "feat(server): sync tracker snapshot from game state"
```

### Task 3: Client Test Harness And Game Store Tracker State

**Files:**
- Create: `packages/client/src/store/__tests__/useGameStore.test.ts`
- Modify: `packages/client/src/store/useGameStore.ts`
- Modify: `packages/client/package.json`

**Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { GamePhase, Rank, Suit } from "@blitzlord/shared";
import { useGameStore } from "../useGameStore";

describe("useGameStore tracker state", () => {
  beforeEach(() => {
    useGameStore.getState().resetGame();
  });

  it("replaces tracker state from syncState and keeps panel UI local", () => {
    useGameStore.getState().syncState({
      roomId: "room-1",
      phase: GamePhase.Playing,
      myHand: [{ rank: Rank.Ace, suit: Suit.Spade }],
      myRole: null,
      currentTurn: "p1",
      lastPlay: null,
      consecutivePasses: 0,
      bottomCards: [],
      baseBid: 1,
      bombCount: 0,
      rocketUsed: false,
      players: [],
      callSequence: [],
      tracker: {
        history: [{ sequence: 1, round: 1, playerId: "p2", action: "pass", cards: [] }],
        remainingByRank: [],
      },
    });

    expect(useGameStore.getState().tracker.history).toHaveLength(1);
    expect(useGameStore.getState().isTrackerOpen).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @blitzlord/client test -- src/store/__tests__/useGameStore.test.ts`

Expected: FAIL because the client package has no `test` script and `useGameStore` has no tracker state yet.

**Step 3: Write minimal implementation**

```ts
// packages/client/package.json
"devDependencies": {
  "vitest": "^3.0.0"
},
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "test": "vitest run"
}

// packages/client/src/store/useGameStore.ts
tracker: { history: [], remainingByRank: [] },
isTrackerOpen: false,

syncState: (snapshot) => set({
  ...,
  tracker: snapshot.tracker,
}),

toggleTrackerPanel: () => set((state) => ({ isTrackerOpen: !state.isTrackerOpen })),
syncTracker: (tracker) => set({ tracker }),
appendTrackerPlay: (entry, remainingByRank) => set((state) => ({
  tracker: {
    history: [...state.tracker.history, entry],
    remainingByRank,
  },
})),
appendTrackerPass: (entry) => set((state) => ({
  tracker: {
    history: [...state.tracker.history, entry],
    remainingByRank: state.tracker.remainingByRank,
  },
})),
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @blitzlord/client test -- src/store/__tests__/useGameStore.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/client/package.json packages/client/src/store/useGameStore.ts packages/client/src/store/__tests__/useGameStore.test.ts
git commit -m "feat(client): add tracker state to game store"
```

### Task 4: Tracker Panel UI With Frontend-Design

**Files:**
- Create: `packages/client/src/components/Game/CardTrackerPanel.tsx`
- Create: `packages/client/src/components/Game/__tests__/CardTrackerPanel.test.tsx`
- Modify: `packages/client/src/index.css`

**Step 1: Write the failing test**

```tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Rank } from "@blitzlord/shared";
import CardTrackerPanel from "../CardTrackerPanel";

describe("CardTrackerPanel", () => {
  it("renders rank stats and tracker history", () => {
    const html = renderToStaticMarkup(
      <CardTrackerPanel
        open
        onClose={() => {}}
        remainingByRank={[
          {
            rank: Rank.Ace,
            totalCopies: 4,
            playedCopies: 1,
            myCopies: 1,
            remainingOpponentCopies: 2,
          },
        ]}
        history={[
          {
            sequence: 3,
            round: 2,
            playerId: "p2",
            action: "play",
            cards: [],
          },
        ]}
        playerNames={{ p2: "Bob" }}
      />,
    );

    expect(html).toContain("记牌器");
    expect(html).toContain("A");
    expect(html).toContain("Bob");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @blitzlord/client test -- src/components/Game/__tests__/CardTrackerPanel.test.tsx`

Expected: FAIL because `CardTrackerPanel` does not exist yet.

**Step 3: Write minimal implementation**

```tsx
export default function CardTrackerPanel(props: CardTrackerPanelProps) {
  if (!props.open) return null;

  return (
    <aside className="tracker-panel">
      <header className="tracker-panel__header">
        <h2>记牌器</h2>
        <button onClick={props.onClose}>关闭</button>
      </header>
      <section>
        {props.remainingByRank.map((entry) => (
          <div key={entry.rank}>
            <span>{rankLabel(entry.rank)}</span>
            <span>{entry.remainingOpponentCopies}</span>
          </div>
        ))}
      </section>
      <section>
        {props.history.map((entry) => (
          <div key={entry.sequence}>
            <span>{props.playerNames[entry.playerId] ?? entry.playerId}</span>
            <span>{entry.action === "pass" ? "不出" : "出牌"}</span>
          </div>
        ))}
      </section>
    </aside>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @blitzlord/client test -- src/components/Game/__tests__/CardTrackerPanel.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/client/src/components/Game/CardTrackerPanel.tsx packages/client/src/components/Game/__tests__/CardTrackerPanel.test.tsx packages/client/src/index.css
git commit -m "feat(client): add card tracker panel"
```

### Task 5: GameBoard Integration, Incremental Updates, And Manual Smoke

**Files:**
- Modify: `packages/client/src/components/Game/GameBoard.tsx`
- Modify: `packages/client/src/components/Game/PlayedCards.tsx`
- Modify: `packages/client/src/components/Game/OpponentArea.tsx`

**Step 1: Write the failing test or smoke checklist first**

```md
- 默认不展开记牌器
- 点击“记牌器”按钮后显示点数谱和牌谱
- 收到 game:cardsPlayed 后历史新增一条出牌记录
- 收到 game:passed 后历史新增一条不出记录
- 收到 game:syncState 后历史与点数谱整体恢复
- 地主拿到底牌后点数统计立即更新
```

**Step 2: Run the most specific automated verification available**

Run: `pnpm --filter @blitzlord/client test`

Expected: FAIL or incomplete before `GameBoard` 接入，因为还没有把面板和增量事件连到页面。

**Step 3: Write minimal implementation**

```tsx
// GameBoard top bar
<button
  type="button"
  className="tracker-toggle"
  onClick={() => store.toggleTrackerPanel()}
>
  记牌器
</button>

<CardTrackerPanel
  open={isTrackerOpen}
  onClose={() => store.toggleTrackerPanel()}
  remainingByRank={tracker.remainingByRank}
  history={[...tracker.history].reverse()}
  playerNames={playerNames}
/>

// onSyncState
store.syncState(snapshot);

// onCardsPlayed
store.appendTrackerPlay(
  {
    sequence: store.tracker.history.length + 1,
    round: inferNextRound(store.tracker.history, false),
    playerId: data.playerId,
    action: "play",
    cards: data.play.cards,
  },
  buildCardTrackerSnapshot({
    myHand: nextMyHand,
    history: [...store.tracker.history, newEntry],
  }).remainingByRank,
);

// onPassed
store.appendTrackerPass({
  sequence: store.tracker.history.length + 1,
  round: inferNextRound(store.tracker.history, data.resetRound),
  playerId: data.playerId,
  action: "pass",
  cards: [],
});
```

**Step 4: Run verification**

Run: `pnpm --filter @blitzlord/client test`

Expected: PASS

Run: `pnpm build`

Expected: PASS

Then run manual smoke from the checklist in three browser tabs.

**Step 5: Commit**

```bash
git add packages/client/src/components/Game/GameBoard.tsx packages/client/src/components/Game/PlayedCards.tsx packages/client/src/components/Game/OpponentArea.tsx
git commit -m "feat(client): integrate tracker panel into game board"
```
