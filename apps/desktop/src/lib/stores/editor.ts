import { derived, get, writable } from 'svelte/store';
import {
  addElement,
  addSlide,
  canRedo,
  canUndo,
  closeHistoryGroup as closeHistoryGroupState,
  commitHistory,
  createElement,
  createHistoryState,
  createSlide,
  duplicateElements,
  duplicateSlide,
  moveElementLayer,
  redoHistory,
  removeElement,
  removeSlide,
  reorderSlide,
  undoHistory,
  updateElement,
  updateSlideNotes
} from '@slaides/editor-core';
import { createSampleDocument } from '@slaides/slide-schema';
import type { HistoryState } from '@slaides/editor-core';
import type {
  AssetReference,
  SlideDocument,
  SlideElement
} from '@slaides/slide-schema';

export interface EditorSnapshot {
  document: SlideDocument;
  activeSlideId: string;
  selectedElementIds: string[];
  documentRevision: number;
}

export interface EditorActionOptions {
  mergeKey?: string;
  mergeWindowMs?: number;
}

export interface PatchElementOptions extends EditorActionOptions {
  label?: string;
}

export interface EditorRuntimeState {
  session: EditorSnapshot;
  history: HistoryState<EditorSnapshot>;
  zoom: number;
  assetUrls: Array<[string, string]>;
}

const initialDocument = createSampleDocument();
const initialSnapshot: EditorSnapshot = {
  document: initialDocument,
  activeSlideId: initialDocument.slides[0].id,
  selectedElementIds: [],
  documentRevision: 0
};
let nextDocumentRevision = 1;

export const editorSessionStore = writable<EditorSnapshot>(initialSnapshot);
export const historyStore = writable<HistoryState<EditorSnapshot>>(
  createHistoryState(100)
);
export const documentStore = derived(
  editorSessionStore,
  ($session) => $session.document
);
export const activeSlideId = derived(
  editorSessionStore,
  ($session) => $session.activeSlideId
);
export const selectedElementIds = derived(
  editorSessionStore,
  ($session) => $session.selectedElementIds
);
export const zoomStore = writable(1);
export const canvasTextEditingStore = writable(false);
export const canUndoStore = derived(historyStore, ($history) =>
  canUndo($history)
);
export const canRedoStore = derived(historyStore, ($history) =>
  canRedo($history)
);
export const undoLabelStore = derived(
  historyStore,
  ($history) => $history.past.at(-1)?.label
);
export const redoLabelStore = derived(
  historyStore,
  ($history) => $history.future.at(-1)?.label
);
export const activeSlide = derived(editorSessionStore, ($session) =>
  $session.document.slides.find((slide) => slide.id === $session.activeSlideId)
);
export const selectedElements = derived(editorSessionStore, ($session) => {
  const slide = $session.document.slides.find(
    (item) => item.id === $session.activeSlideId
  );
  return (
    slide?.elements.filter((element) =>
      $session.selectedElementIds.includes(element.id)
    ) ?? []
  );
});

const assetUrls = new Map<string, string>();

function normalizeSnapshot(snapshot: EditorSnapshot): EditorSnapshot {
  const activeSlide =
    snapshot.document.slides.find(
      (slide) => slide.id === snapshot.activeSlideId
    ) ?? snapshot.document.slides[0];
  if (!activeSlide) return snapshot;
  const validIds = new Set(activeSlide.elements.map((element) => element.id));
  const selectedElementIds = [
    ...new Set(snapshot.selectedElementIds.filter((id) => validIds.has(id)))
  ];
  if (
    activeSlide.id === snapshot.activeSlideId &&
    selectedElementIds.length === snapshot.selectedElementIds.length &&
    selectedElementIds.every(
      (id, index) => id === snapshot.selectedElementIds[index]
    )
  )
    return snapshot;
  return {
    ...snapshot,
    activeSlideId: activeSlide.id,
    selectedElementIds
  };
}

function collectAssetIds(
  snapshot: EditorSnapshot,
  retained: Set<string>
): void {
  for (const asset of snapshot.document.assets) retained.add(asset.id);
}

function releaseUnreachableAssets(
  session: EditorSnapshot,
  history: HistoryState<EditorSnapshot>
): void {
  const retained = new Set<string>();
  collectAssetIds(session, retained);
  for (const entry of [...history.past, ...history.future]) {
    collectAssetIds(entry.before, retained);
    collectAssetIds(entry.after, retained);
  }
  for (const [assetId, url] of assetUrls) {
    if (retained.has(assetId)) continue;
    URL.revokeObjectURL(url);
    assetUrls.delete(assetId);
  }
}

export function commitEditorAction(
  label: string,
  updater: (snapshot: EditorSnapshot) => EditorSnapshot,
  options: EditorActionOptions = {}
): boolean {
  const before = get(editorSessionStore);
  const updated = normalizeSnapshot(updater(before));
  const after = { ...updated, documentRevision: nextDocumentRevision++ };
  if (Object.is(before.document, after.document)) return false;
  const history = commitHistory(get(historyStore), before, after, {
    label,
    mergeKey: options.mergeKey,
    mergeWindowMs: options.mergeWindowMs
  });
  historyStore.set(history);
  editorSessionStore.set(after);
  releaseUnreachableAssets(after, history);
  return true;
}

export function closeHistoryGroup(mergeKey?: string): void {
  historyStore.update((history) => closeHistoryGroupState(history, mergeKey));
}

export function undo(): void {
  const current = get(editorSessionStore);
  const closed = closeHistoryGroupState(get(historyStore));
  const transition = undoHistory(closed, current);
  if (!transition.entry) return;
  const next = normalizeSnapshot(transition.value);
  historyStore.set(transition.history);
  editorSessionStore.set(next);
  releaseUnreachableAssets(next, transition.history);
}

export function redo(): void {
  const current = get(editorSessionStore);
  const closed = closeHistoryGroupState(get(historyStore));
  const transition = redoHistory(closed, current);
  if (!transition.entry) return;
  const next = normalizeSnapshot(transition.value);
  historyStore.set(transition.history);
  editorSessionStore.set(next);
  releaseUnreachableAssets(next, transition.history);
}

export function resetEditorSession(
  document: SlideDocument = createSampleDocument(),
  documentRevision = 0
): void {
  const snapshot = normalizeSnapshot({
    document,
    activeSlideId: document.slides[0].id,
    selectedElementIds: [],
    documentRevision
  });
  editorSessionStore.set(snapshot);
  const history = createHistoryState<EditorSnapshot>(100);
  historyStore.set(history);
  releaseUnreachableAssets(snapshot, history);
}

export function selectSlide(slideId: string): void {
  editorSessionStore.update((session) => {
    if (
      session.activeSlideId === slideId ||
      !session.document.slides.some((slide) => slide.id === slideId)
    )
      return session;
    return { ...session, activeSlideId: slideId, selectedElementIds: [] };
  });
}

export function selectElements(ids: string[]): void {
  editorSessionStore.update((session) => {
    const slide = session.document.slides.find(
      (item) => item.id === session.activeSlideId
    );
    const validIds = new Set(slide?.elements.map((element) => element.id));
    const unique = [...new Set(ids.filter((id) => validIds.has(id)))];
    if (
      session.selectedElementIds.length === unique.length &&
      session.selectedElementIds.every((id) => unique.includes(id))
    )
      return session;
    return { ...session, selectedElementIds: unique };
  });
}

export const resolveAssetUrl = (asset: AssetReference) =>
  assetUrls.get(asset.id);

export function captureAssetUrls(): Array<[string, string]> {
  return [...assetUrls.entries()];
}

export function restoreAssetUrls(entries: Array<[string, string]>): void {
  assetUrls.clear();
  for (const [assetId, url] of entries) assetUrls.set(assetId, url);
}

export function captureEditorRuntime(): EditorRuntimeState {
  return {
    session: get(editorSessionStore),
    history: get(historyStore),
    zoom: get(zoomStore),
    assetUrls: captureAssetUrls()
  };
}

export function restoreEditorRuntime(runtime: EditorRuntimeState): void {
  editorSessionStore.set(runtime.session);
  historyStore.set(runtime.history);
  zoomStore.set(runtime.zoom);
  canvasTextEditingStore.set(false);
  restoreAssetUrls(runtime.assetUrls);
}

export function addNewSlide(): void {
  const slide = createSlide();
  commitEditorAction('Add slide', (snapshot) => ({
    ...snapshot,
    document: addSlide(snapshot.document, slide),
    activeSlideId: slide.id,
    selectedElementIds: []
  }));
}

export function duplicateActiveSlide(): void {
  commitEditorAction('Duplicate slide', (snapshot) => {
    const document = duplicateSlide(snapshot.document, snapshot.activeSlideId);
    const index = document.slides.findIndex(
      (slide) => slide.id === snapshot.activeSlideId
    );
    return {
      ...snapshot,
      document,
      activeSlideId: document.slides[index + 1]?.id ?? snapshot.activeSlideId,
      selectedElementIds: []
    };
  });
}

export function deleteActiveSlide(): void {
  commitEditorAction('Delete slide', (snapshot) => {
    const index = snapshot.document.slides.findIndex(
      (slide) => slide.id === snapshot.activeSlideId
    );
    const document = removeSlide(snapshot.document, snapshot.activeSlideId);
    const next = document.slides[Math.max(0, index - 1)] ?? document.slides[0];
    return {
      ...snapshot,
      document,
      activeSlideId: next.id,
      selectedElementIds: []
    };
  });
}

export function moveSlide(from: number, to: number): void {
  commitEditorAction('Reorder slide', (snapshot) => ({
    ...snapshot,
    document: reorderSlide(snapshot.document, from, to)
  }));
}

export function insertElement(
  type: 'text' | 'shape' | 'line',
  shapeType?: 'rectangle' | 'rounded-rectangle' | 'ellipse' | 'triangle'
): void {
  let element = createElement(type);
  if (element.type === 'shape' && shapeType)
    element = {
      ...element,
      shapeType,
      cornerRadius: shapeType === 'rounded-rectangle' ? 220 : undefined
    };
  commitEditorAction(`Add ${type}`, (snapshot) => ({
    ...snapshot,
    document: addElement(snapshot.document, snapshot.activeSlideId, element),
    activeSlideId: snapshot.activeSlideId,
    selectedElementIds: [element.id]
  }));
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== 'object' || typeof right !== 'object') return false;
  return JSON.stringify(left) === JSON.stringify(right);
}

export function patchElement(
  elementId: string,
  changes: Partial<SlideElement>,
  options: PatchElementOptions = {}
): void {
  const snapshot = get(editorSessionStore);
  const element = snapshot.document.slides
    .find((slide) => slide.id === snapshot.activeSlideId)
    ?.elements.find((item) => item.id === elementId);
  if (
    !element ||
    Object.entries(changes).every(([key, value]) =>
      valuesEqual(element[key as keyof SlideElement], value)
    )
  )
    return;
  commitEditorAction(
    options.label ?? `Edit ${element.type}`,
    (current) => ({
      ...current,
      document: updateElement(
        current.document,
        current.activeSlideId,
        elementId,
        changes
      )
    }),
    options
  );
}

export function duplicateSelected(): void {
  const selected = get(editorSessionStore).selectedElementIds;
  if (!selected.length) return;
  commitEditorAction('Duplicate objects', (snapshot) => {
    const result = duplicateElements(
      snapshot.document,
      snapshot.activeSlideId,
      snapshot.selectedElementIds
    );
    return {
      ...snapshot,
      document: result.document,
      selectedElementIds: result.elementIds
    };
  });
}

export function deleteSelected(): void {
  const selected = get(editorSessionStore).selectedElementIds;
  if (!selected.length) return;
  commitEditorAction('Delete objects', (snapshot) => ({
    ...snapshot,
    document: removeElement(
      snapshot.document,
      snapshot.activeSlideId,
      snapshot.selectedElementIds
    ),
    selectedElementIds: []
  }));
}

export function moveLayer(
  elementId: string,
  direction: 'front' | 'forward' | 'backward' | 'back'
): void {
  commitEditorAction('Reorder layer', (snapshot) => ({
    ...snapshot,
    document: moveElementLayer(
      snapshot.document,
      snapshot.activeSlideId,
      elementId,
      direction
    )
  }));
}

export function patchSlideNotes(text: string): void {
  const current = get(editorSessionStore);
  const slideId = current.activeSlideId;
  const currentText = current.document.slides.find(
    (slide) => slide.id === slideId
  )?.notes?.text;
  if ((currentText ?? '') === text) return;
  commitEditorAction(
    'Edit slide notes',
    (snapshot) => ({
      ...snapshot,
      document: updateSlideNotes(snapshot.document, slideId, text)
    }),
    { mergeKey: `notes:${slideId}` }
  );
}

export async function insertImage(file: File): Promise<void> {
  const bytes = await file.arrayBuffer();
  const hashBytes = new Uint8Array(
    await crypto.subtle.digest('SHA-256', bytes)
  );
  const hash = [...hashBytes]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
  const current = get(editorSessionStore);
  const existing = current.document.assets.find((asset) => asset.hash === hash);
  const assetId = existing?.id ?? crypto.randomUUID();
  if (!existing) assetUrls.set(assetId, URL.createObjectURL(file));
  const asset: AssetReference | undefined = existing
    ? undefined
    : {
        id: assetId,
        kind: 'image',
        hash,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        localPath: `assets/${hash}.${file.name.split('.').pop()?.toLowerCase() || 'bin'}`,
        createdAt: new Date().toISOString()
      };
  const element = createElement('image', { assetId });
  commitEditorAction('Add image', (snapshot) => {
    const withAsset = asset
      ? { ...snapshot.document, assets: [...snapshot.document.assets, asset] }
      : snapshot.document;
    return {
      ...snapshot,
      document: addElement(withAsset, snapshot.activeSlideId, element),
      activeSlideId: snapshot.activeSlideId,
      selectedElementIds: [element.id]
    };
  });
}

export function disposeAssets(): void {
  for (const url of assetUrls.values()) URL.revokeObjectURL(url);
  assetUrls.clear();
}
