# SlAIdes architecture

## Architectural layers

SlAIdes uses four layers with dependencies pointing inward:

```text
UI -> Application -> Domain
                       ^
                       |
              Infrastructure adapters
```

- **UI:** Svelte components, editor chrome, and user interaction.
- **Application:** commands, history, persistence orchestration, export, and AI operation handling.
- **Domain:** `SlideDocument`, slides, elements, themes, assets, and validation rules.
- **Infrastructure:** Tauri, Fabric.js, SQLite, file archives, secure storage, exporters, and AI providers.

The domain package cannot import UI or infrastructure libraries. Infrastructure adapters translate
between external systems and domain types without making external representations canonical.

## Canonical document

`SlideDocument` is the sole source of truth. Future canvas objects are projections:

```text
SlideDocument -> Canvas adapter -> Render objects
```

Canvas events must be normalized into application commands that update `SlideDocument`. Fabric.js
objects or Fabric-specific JSON must never be persisted as the SlAIdes document format.

All external JSON is treated as `unknown` and validated with the strict Zod schema before entering
the application. The current schema version is `1`. A `DocumentMigrator` contract is reserved for
ordered future migrations; no migration is needed while version 1 is the only format.

## Phase 1 and 2 boundary

This phase provides the pnpm workspace, static SvelteKit UI, minimal Tauri 2 host, canonical domain
types, schemas, defaults, JSON serialization, tests, and cross-platform CI configuration.

It deliberately excludes canvas rendering, application commands, Undo/Redo, `.slaides` archives,
SQLite, secure secret storage, PPTX/PNG export, and AI providers. Tauri currently has only core
window permissions and no infrastructure plugins.

## Domain decisions

- Coordinates use SlAIdes logical units: 1,000 units equal one inch.
- The standard slide size is 13,333 by 7,500 units (16:9).
- IDs are UUIDs and stored timestamps are ISO 8601 UTC strings.
- Backgrounds are a solid color in the initial schema; speaker notes contain plain text.
- Document and slide metadata contain creation and update timestamps. Additions require a schema
  version change rather than silently accepting unknown fields.
- Asset records reference local files and SHA-256 hashes; binary data is never embedded in a
  `SlideDocument`.

## Next adapter boundary

Phase 3 should add an `editor-core` application package and a `canvas-fabric` infrastructure
package. The adapter will accept domain elements and emit normalized changes; it must not leak
Fabric types into `slide-schema` or make the renderer responsible for document history.

## Phase 3 editor architecture

Phase 3 adds `editor-core` as the infrastructure-independent application layer and
`canvas-fabric` as a rendering adapter. UI and normalized canvas events call immutable editor-core
operations; the resulting `SlideDocument` is then projected back onto Fabric.js. Fabric objects
carry only their domain element ID and are never serialized.

The desktop workspace uses a fixed three-column studio layout: a vertical Slides rail, the central
document surface, and a tabbed Design/Layers/AI inspector. Panels are intentionally not dockable,
so the editing surface remains predictable and no workspace layout is persisted. Session image
Object URLs are resolved outside the domain and revoked when the editor closes.

Within an active slide, `CanvasController` reconciles domain changes onto existing Fabric objects.
Only a slide change replaces the canvas contents. Programmatic selection changes are silent, while
user selection, completed transforms, and text edits emit normalized events back to the document
store. This preserves selection, text-editing focus, and object identity across property updates.
