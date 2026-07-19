# SlAIdes Desktop

The minimal Tauri 2 desktop shell backed by a statically generated SvelteKit frontend.

```sh
pnpm --filter @slaides/desktop dev
pnpm --filter @slaides/desktop tauri dev
pnpm --filter @slaides/desktop tauri build --no-bundle
```

Phase 3 adds the fixed-layout editor and Fabric.js adapter. Phase 4 adds a 100-entry in-memory
Undo/Redo history. Phase 5 adds document tabs, atomic ZIP-based `.slaides` files, recovery-only
autosave, recent files, workspace restoration, and SQLite indexing. Version history, export, and AI
connectivity remain disabled until their respective phases.

Active-slide edits are reconciled onto existing Fabric objects so selection and text focus remain
stable. The AI panel is an offline UI preview; speaker notes are kept only in the in-memory
`SlideDocument`.

Undo/Redo shortcuts are `Cmd/Ctrl + Z`, `Cmd/Ctrl + Shift + Z`, and `Ctrl + Y`. Input fields and
Fabric text editing retain their native text-level Undo behavior. `Cmd/Ctrl + D` duplicates selected
objects. History is intentionally discarded when the app closes. Saved documents and crash
recovery drafts are restored as fresh editing sessions; only Save and Save As update formal files.

The interface and newly inserted text use bundled IBM Plex Sans, with Noto Sans JP as the Japanese
fallback. Object and slide clipboards support `Cmd/Ctrl + C/X/V` and context menus. Text elements
store character ranges for mixed font family, size, weight, style, and color; the Design panel also
provides title, heading, subheading, body, and caption size presets.
