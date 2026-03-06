# Repository Guidelines

## Project Structure & Module Organization
This repository is a `pnpm` monorepo with three workspace packages under `packages/`:

- `client`: React 19 + Vite frontend (`src/components`, `src/routes`, `src/store`, `src/socket`)
- `server`: Socket.IO backend (`src/room`, `src/game`, `src/session`, `src/socket`)
- `shared`: cross-package types, rules, constants, and utilities used by both client and server

Project notes live in `docs/`. Deployment-related files are in `.github/workflows/` and `render.yaml`.

## Build, Test, and Development Commands
- `pnpm install`: install workspace dependencies
- `pnpm dev`: run client and server in parallel
- `pnpm dev:client`: start the Vite app on `http://localhost:5173`
- `pnpm dev:server`: start the Socket.IO server on `http://localhost:3001`
- `pnpm test`: run all workspace tests
- `pnpm test:shared`: run only shared rule and utility tests
- `pnpm --filter @blitzlord/server test`: run backend tests directly
- `pnpm build`: build all packages that expose a build script

## Coding Style & Naming Conventions
Use TypeScript with ESM imports, semicolons, and the existing double-quote style. Follow the current two-space indentation pattern. Keep React components and manager classes in PascalCase (`GameBoard.tsx`, `RoomManager.ts`), hooks and Zustand stores in `useXxx` form (`useSocketStore.ts`), and utilities in camelCase filenames (`cardEquals.ts`).

For server-side TypeScript, keep relative imports using the `.js` suffix to stay compatible with ESM execution.

## Testing Guidelines
Tests use Vitest. Place tests in `src/__tests__/` and name them `*.test.ts`. Add shared tests for pure game rules and utilities; add server tests for room, session, and socket handler flows. Client changes currently rely on manual verification, so include a brief smoke-test note in your PR when UI behavior changes.

## Commit & Pull Request Guidelines
Recent history uses Conventional Commits, for example: `feat(client): ...`, `fix: ...`, `docs: ...`, and `ci: ...`. Keep messages scoped when the change is package-specific.

PRs should include a short summary, affected packages, test commands run, and screenshots for visible client updates. Call out deployment-related changes explicitly when touching `.github/workflows/` or `render.yaml`.

## Security & Configuration Tips
Do not commit secrets. Use environment variables such as `PORT` and `CORS_ORIGIN` for server configuration, and keep local defaults suitable for development only.
