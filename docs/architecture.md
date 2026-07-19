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

## Phase 4 history architecture

Phase 4 routes every document mutation through a desktop application transaction. Each committed
transaction stores immutable before/after snapshots containing the canonical `SlideDocument`, the
active slide ID, and selected element IDs. `editor-core` owns the UI-independent history state
transitions; Svelte stores only orchestrate transactions and apply snapshots.

The session keeps at most 100 entries. Completed canvas transforms are one entry, while consecutive
text, property, and notes changes sharing a merge key are coalesced for 750 milliseconds or until
focus leaves the editor. Undo followed by a new edit discards the redo branch. Selection-only,
zoom, pan, and panel-layout changes never enter history.

Session image Object URLs are retained while referenced by the current snapshot or either history
stack, then revoked when unreachable. History remains memory-only: `.slaides` archives, autosave,
recovery, recent files, and SQLite belong to Phase 5, while long-lived version history belongs to
Phase 6.

## Phase 5 local persistence and workspace

Each workspace tab owns its `SlideDocument`, memory-only history, editor view state, revision
counters, save metadata, and asset URL cache. Switching tabs projects that tab into the active
editor stores and captures the previous tab first. View-only state such as selection, zoom,
viewport, tool, and inspector tab is separate from the canonical document and does not affect the
dirty state.

Document revisions identify committed document states. A tab is dirty when its current revision
differs from the last formally saved revision; Undo can therefore return a tab to clean. Formal
saves also calculate a recursively key-sorted canonical JSON SHA-256 hash for integrity and the
project index. A save operates on a fixed document/revision snapshot, so edits made while I/O is in
progress remain dirty after that save completes.

`.slaides` files are ZIP archives containing required `document.json`, `metadata.json`, and every
currently referenced `assets/<sha256>.<extension>` entry. `archiveVersion` describes the container,
while `schemaVersion` describes the domain JSON. Optional 320×180 PNG thumbnails are derived data;
failure to generate one produces a warning rather than failing the save. Rust rejects unsafe or
duplicate paths, unsupported versions, expansion beyond the configured limit, missing assets, and
asset hash mismatches before validated JSON is passed to the existing Zod boundary.

Manual Save writes a temporary archive in the destination directory, flushes and syncs it,
re-opens it for verification, moves an existing file to a backup, then renames the verified file
into place. Rename is retried briefly for Windows file-lock races. Autosave never follows this path
to the formal file: after two idle seconds it writes a separate recovery archive in App Data.
Successful formal save or an explicit Don't Save removes recovery data.

SQLite stores only the project/recent index, workspace layout settings, and recovery-draft index;
it is not a document source of truth. Startup reopens saved tab paths and valid ready recovery
archives, but initializes every Undo/Redo history as empty. Object URLs remain cached per tab and
are revoked together when the tab or application closes. Persistent versions and branches remain
Phase 6 responsibilities.
