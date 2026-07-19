# SlAIdes Desktop

The minimal Tauri 2 desktop shell backed by a statically generated SvelteKit frontend.

```sh
pnpm --filter @slaides/desktop dev
pnpm --filter @slaides/desktop tauri dev
pnpm --filter @slaides/desktop tauri build --no-bundle
```

No file-system, database, secret-storage, canvas, export, or AI plugins are enabled in Phase 1.

Phase 3 adds the in-memory fixed-layout editor, Fabric.js canvas adapter, object properties, layers,
slide management, and session-only image import. Saving, history, export, and AI connectivity remain
disabled until their respective phases.

Active-slide edits are reconciled onto existing Fabric objects so selection and text focus remain
stable. The AI panel is an offline UI preview; speaker notes are kept only in the in-memory
`SlideDocument`.
