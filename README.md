# SlAIdes

SlAIdes is a desktop slide editor built with Tauri 2, SvelteKit, TypeScript, and Fabric.js.
The current implementation covers the project/domain foundation, canvas editor, Phase 4 session
history, and Phase 5 local `.slaides` persistence with a multi-document workspace.

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

Use `Cmd/Ctrl + N`, `O`, `S`, `Shift + S`, and `W` for New, Open, Save, Save As, and Close Tab.
Formal project files are changed only by Save. Two seconds after an edit, SlAIdes writes a separate
recovery archive; this does not clear the tab's dirty state.

## Workspace

- `apps/desktop`: Tauri 2 and SvelteKit desktop shell
- `packages/slide-schema`: canonical SlideDocument types and validation
- `packages/editor-core`: immutable editing and generic snapshot history
- `packages/canvas-fabric`: Fabric.js rendering and normalized canvas events
- `docs/architecture.md`: architecture decisions and phase boundaries
