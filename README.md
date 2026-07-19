# SlAIdes

SlAIdes is a desktop slide editor built with Tauri 2, SvelteKit, TypeScript, and Fabric.js.
The current implementation covers the project/domain foundation, the in-memory canvas editor, and
Phase 4 session Undo/Redo history.

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
- `packages/editor-core`: immutable editing and generic snapshot history
- `packages/canvas-fabric`: Fabric.js rendering and normalized canvas events
- `docs/architecture.md`: architecture decisions and phase boundaries
