import { derived, get, writable } from 'svelte/store';
import {
  addElement,
  addSlide,
  createElement,
  createSlide,
  duplicateSlide,
  moveElementLayer,
  removeElement,
  removeSlide,
  reorderSlide,
  updateElement,
  updateSlideNotes
} from '@slaides/editor-core';
import { createSampleDocument } from '@slaides/slide-schema';
import type {
  AssetReference,
  SlideDocument,
  SlideElement
} from '@slaides/slide-schema';

export const documentStore = writable<SlideDocument>(createSampleDocument());
export const activeSlideId = writable(get(documentStore).slides[0].id);
export const selectedElementIds = writable<string[]>([]);
export const zoomStore = writable(1);
export const activeSlide = derived(
  [documentStore, activeSlideId],
  ([$document, $id]) =>
    $document.slides.find((slide) => slide.id === $id) ?? $document.slides[0]
);
export const selectedElements = derived(
  [activeSlide, selectedElementIds],
  ([$slide, $ids]) =>
    $slide?.elements.filter((element) => $ids.includes(element.id)) ?? []
);

export function selectElements(ids: string[]): void {
  const unique = [...new Set(ids)];
  const current = get(selectedElementIds);
  if (
    current.length === unique.length &&
    current.every((id) => unique.includes(id))
  )
    return;
  selectedElementIds.set(unique);
}

const assetUrls = new Map<string, string>();
export const resolveAssetUrl = (asset: AssetReference) =>
  assetUrls.get(asset.id);

function update(updater: (document: SlideDocument) => SlideDocument): void {
  documentStore.update(updater);
}
export function addNewSlide(): void {
  const slide = createSlide();
  update((doc) => addSlide(doc, slide));
  activeSlideId.set(slide.id);
  selectedElementIds.set([]);
}
export function duplicateActiveSlide(): void {
  const id = get(activeSlideId);
  update((doc) => duplicateSlide(doc, id));
  const doc = get(documentStore);
  const index = doc.slides.findIndex((slide) => slide.id === id);
  activeSlideId.set(doc.slides[index + 1]?.id ?? id);
}
export function deleteActiveSlide(): void {
  const id = get(activeSlideId);
  const doc = get(documentStore);
  const index = doc.slides.findIndex((slide) => slide.id === id);
  update((value) => removeSlide(value, id));
  const next = get(documentStore).slides[Math.max(0, index - 1)];
  if (next) activeSlideId.set(next.id);
  selectedElementIds.set([]);
}
export function moveSlide(from: number, to: number): void {
  update((doc) => reorderSlide(doc, from, to));
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
  update((doc) => addElement(doc, get(activeSlideId), element));
  selectedElementIds.set([element.id]);
}
export function patchElement(
  elementId: string,
  changes: Partial<SlideElement>
): void {
  update((doc) => updateElement(doc, get(activeSlideId), elementId, changes));
}
export function deleteSelected(): void {
  const ids = get(selectedElementIds);
  if (!ids.length) return;
  update((doc) => removeElement(doc, get(activeSlideId), ids));
  selectedElementIds.set([]);
}
export function moveLayer(
  elementId: string,
  direction: 'front' | 'forward' | 'backward' | 'back'
): void {
  update((doc) =>
    moveElementLayer(doc, get(activeSlideId), elementId, direction)
  );
}

export function patchSlideNotes(text: string): void {
  update((doc) => updateSlideNotes(doc, get(activeSlideId), text));
}

export async function insertImage(file: File): Promise<void> {
  const bytes = await file.arrayBuffer();
  const hashBytes = new Uint8Array(
    await crypto.subtle.digest('SHA-256', bytes)
  );
  const hash = [...hashBytes]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
  const existing = get(documentStore).assets.find(
    (asset) => asset.hash === hash
  );
  const assetId = existing?.id ?? crypto.randomUUID();
  if (!existing) {
    const url = URL.createObjectURL(file);
    assetUrls.set(assetId, url);
    const asset: AssetReference = {
      id: assetId,
      kind: 'image',
      hash,
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      localPath: `session://${assetId}/${file.name}`,
      createdAt: new Date().toISOString()
    };
    documentStore.update((doc) => ({ ...doc, assets: [...doc.assets, asset] }));
  }
  const element = createElement('image', { assetId });
  update((doc) => addElement(doc, get(activeSlideId), element));
  selectedElementIds.set([element.id]);
}
export function disposeAssets(): void {
  for (const url of assetUrls.values()) URL.revokeObjectURL(url);
  assetUrls.clear();
}
