# SlAIdes

SlAIdes is a desktop slide editor foundation built with Tauri 2, SvelteKit, and TypeScript.
This repository currently implements Phase 1 (project foundation) and Phase 2 (domain model).

## Requirements

- Node.js 20 or later
- pnpm 11
- A stable Rust toolchain
- Tauri 2 platform prerequisites for macOS or Windows

## Development

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm tauri:dev
```

Run `pnpm lint`, `pnpm build`, and the `rust:*` scripts before submitting changes.

## Workspace

- `apps/desktop`: Tauri 2 and SvelteKit desktop shell
- `packages/slide-schema`: canonical SlideDocument types and validation
- `docs/architecture.md`: architecture decisions and phase boundaries
