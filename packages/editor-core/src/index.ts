import type {
  BaseSlideElement,
  ImageElement,
  LineElement,
  ShapeElement,
  Slide,
  SlideDocument,
  SlideElement,
  SlideElementType,
  TextElement,
  TextStyleAttributes,
  TextStyleRange
} from '@slaides/slide-schema';
import { splitTextGraphemes } from '@slaides/slide-schema';

export interface CreateContext {
  id?: string;
  now?: string;
  assetId?: string;
}

export type LayerDirection = 'front' | 'forward' | 'backward' | 'back';

export interface HistoryEntry<T> {
  id: string;
  label: string;
  before: T;
  after: T;
  createdAt: number;
  mergeKey?: string;
}

export interface HistoryState<T> {
  past: HistoryEntry<T>[];
  future: HistoryEntry<T>[];
  limit: number;
}

export interface HistoryTransition<T> {
  history: HistoryState<T>;
  value: T;
  entry?: HistoryEntry<T>;
}

export interface CommitHistoryOptions {
  label: string;
  id?: string;
  createdAt?: number;
  mergeKey?: string;
  mergeWindowMs?: number;
}

export function createHistoryState<T>(limit = 100): HistoryState<T> {
  return { past: [], future: [], limit: Math.max(1, Math.floor(limit)) };
}

export function commitHistory<T>(
  history: HistoryState<T>,
  before: T,
  after: T,
  options: CommitHistoryOptions
): HistoryState<T> {
  if (Object.is(before, after)) return history;
  const createdAt = options.createdAt ?? Date.now();
  const mergeWindowMs = options.mergeWindowMs ?? 750;
  const last = history.past.at(-1);
  const canMerge =
    Boolean(options.mergeKey) &&
    Boolean(last) &&
    last?.mergeKey === options.mergeKey &&
    createdAt - (last?.createdAt ?? 0) <= mergeWindowMs;
  const entry: HistoryEntry<T> = {
    id: options.id ?? crypto.randomUUID(),
    label: options.label,
    before: canMerge && last ? last.before : before,
    after,
    createdAt,
    mergeKey: options.mergeKey
  };
  const past = canMerge
    ? [...history.past.slice(0, -1), entry]
    : [...history.past, entry].slice(-history.limit);
  return { ...history, past, future: [] };
}

export function closeHistoryGroup<T>(
  history: HistoryState<T>,
  mergeKey?: string
): HistoryState<T> {
  const last = history.past.at(-1);
  if (!last?.mergeKey || (mergeKey && last.mergeKey !== mergeKey))
    return history;
  return {
    ...history,
    past: [...history.past.slice(0, -1), { ...last, mergeKey: undefined }]
  };
}

export function undoHistory<T>(
  history: HistoryState<T>,
  current: T
): HistoryTransition<T> {
  const entry = history.past.at(-1);
  if (!entry) return { history, value: current };
  return {
    history: {
      ...history,
      past: history.past.slice(0, -1),
      future: [...history.future, entry]
    },
    value: entry.before,
    entry
  };
}

export function redoHistory<T>(
  history: HistoryState<T>,
  current: T
): HistoryTransition<T> {
  const entry = history.future.at(-1);
  if (!entry) return { history, value: current };
  return {
    history: {
      ...history,
      past: [...history.past, entry].slice(-history.limit),
      future: history.future.slice(0, -1)
    },
    value: entry.after,
    entry
  };
}

export function clearHistory<T>(history: HistoryState<T>): HistoryState<T> {
  if (!history.past.length && !history.future.length) return history;
  return createHistoryState<T>(history.limit);
}

export const canUndo = <T>(history: HistoryState<T>): boolean =>
  history.past.length > 0;
export const canRedo = <T>(history: HistoryState<T>): boolean =>
  history.future.length > 0;

export interface DuplicateElementsOptions {
  offsetX?: number;
  offsetY?: number;
  idFactory?: (element: SlideElement, index: number) => string;
}

export interface DuplicateElementsResult {
  document: SlideDocument;
  elementIds: string[];
}

export interface PasteElementsOptions extends DuplicateElementsOptions {
  zIndexStart?: number;
}

export function clampCornerRadius(
  width: number,
  height: number,
  value: number
): number {
  return Math.max(
    0,
    Math.min(Number.isFinite(value) ? value : 0, Math.min(width, height) / 2)
  );
}

const clone = <T>(value: T): T => structuredClone(value);
const id = (value?: string) => value ?? crypto.randomUUID();
const now = (value?: string) => value ?? new Date().toISOString();

const base = (
  type: SlideElementType,
  context: CreateContext
): BaseSlideElement => ({
  id: id(context.id),
  type,
  x: 4_666,
  y: 2_750,
  width: 4_000,
  height: 1_000,
  rotation: 0,
  opacity: 1,
  zIndex: 0,
  locked: false,
  hidden: false
});

export function createElement(
  type: Exclude<SlideElementType, 'group'>,
  context: CreateContext = {}
): SlideElement {
  const common = base(type, context);
  if (type === 'text')
    return {
      ...common,
      type,
      text: 'Double-click to edit',
      fontFamily: 'IBM Plex Sans Variable',
      fontSize: 360,
      fontWeight: 600,
      fontStyle: 'normal',
      color: '#111827',
      horizontalAlign: 'center',
      verticalAlign: 'middle',
      lineHeight: 1.2,
      letterSpacing: 0,
      autoFit: 'none',
      padding: { top: 80, right: 80, bottom: 80, left: 80 },
      textStyles: []
    } satisfies TextElement;
  if (type === 'image')
    return {
      ...common,
      type,
      assetId: context.assetId ?? id(),
      fit: 'contain',
      height: 2_250
    } satisfies ImageElement;
  if (type === 'line')
    return {
      ...common,
      type,
      height: 0,
      x2: common.x + common.width,
      y2: common.y,
      stroke: '#52637A',
      strokeWidth: 18,
      startArrow: 'none',
      endArrow: 'none'
    } satisfies LineElement;
  return {
    ...common,
    type: 'shape',
    x: 5_066,
    y: 2_850,
    width: 3_200,
    height: 1_800,
    shapeType: 'rectangle',
    fill: '#DCE7F7',
    stroke: '#6E85A8',
    strokeWidth: 8
  } satisfies ShapeElement;
}

const styleKeys: Array<keyof TextStyleAttributes> = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'color'
];

function compactStyle(style: TextStyleAttributes): TextStyleAttributes {
  return Object.fromEntries(
    styleKeys.flatMap((key) =>
      style[key] === undefined ? [] : [[key, style[key]]]
    )
  ) as TextStyleAttributes;
}

export function applyTextStyleRange(
  ranges: TextStyleRange[],
  start: number,
  end: number,
  changes: TextStyleAttributes
): TextStyleRange[] {
  const safeStart = Math.max(0, Math.floor(start));
  const safeEnd = Math.max(safeStart, Math.floor(end));
  if (safeEnd === safeStart) return ranges;
  const boundaries = new Set([safeStart, safeEnd]);
  for (const range of ranges) {
    boundaries.add(range.start);
    boundaries.add(range.end);
  }
  const points = [...boundaries].sort((left, right) => left - right);
  const result: TextStyleRange[] = [];
  for (let index = 0; index < points.length - 1; index++) {
    const segmentStart = points[index];
    const segmentEnd = points[index + 1];
    const existing = ranges.find(
      (range) => range.start <= segmentStart && range.end >= segmentEnd
    );
    const overlaps = segmentStart < safeEnd && segmentEnd > safeStart;
    const style = compactStyle({
      ...(existing ? compactStyle(existing) : {}),
      ...(overlaps ? changes : {})
    });
    if (!Object.keys(style).length) continue;
    const previous = result.at(-1);
    if (
      previous &&
      previous.end === segmentStart &&
      JSON.stringify(compactStyle(previous)) === JSON.stringify(style)
    )
      previous.end = segmentEnd;
    else result.push({ start: segmentStart, end: segmentEnd, ...style });
  }
  return result;
}

export function clearTextStyleProperties(
  ranges: TextStyleRange[],
  keys: Array<keyof TextStyleAttributes>
): TextStyleRange[] {
  return ranges.flatMap((range) => {
    const style = compactStyle(range);
    for (const key of keys) delete style[key];
    return Object.keys(style).length
      ? [{ start: range.start, end: range.end, ...style }]
      : [];
  });
}

export function rebaseTextStyleRanges(
  ranges: TextStyleRange[],
  previousText: string,
  nextText: string
): TextStyleRange[] {
  const previous = splitTextGraphemes(previousText);
  const next = splitTextGraphemes(nextText);
  let prefix = 0;
  while (
    prefix < previous.length &&
    prefix < next.length &&
    previous[prefix] === next[prefix]
  )
    prefix++;
  let suffix = 0;
  while (
    suffix < previous.length - prefix &&
    suffix < next.length - prefix &&
    previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]
  )
    suffix++;
  const styles = previous.map((_, index) => {
    const range = ranges.find(
      (candidate) => candidate.start <= index && candidate.end > index
    );
    return range ? compactStyle(range) : {};
  });
  const inherited = compactStyle(styles[prefix] ?? styles[prefix - 1] ?? {});
  const insertedLength = next.length - prefix - suffix;
  const rebased = [
    ...styles.slice(0, prefix),
    ...Array.from({ length: insertedLength }, () => inherited),
    ...styles.slice(previous.length - suffix)
  ];
  const result: TextStyleRange[] = [];
  for (let index = 0; index < rebased.length; index++) {
    const style = compactStyle(rebased[index]);
    if (!Object.keys(style).length) continue;
    const previousRange = result.at(-1);
    if (
      previousRange &&
      previousRange.end === index &&
      JSON.stringify(compactStyle(previousRange)) === JSON.stringify(style)
    )
      previousRange.end++;
    else result.push({ start: index, end: index + 1, ...style });
  }
  return result;
}

export function createSlide(context: CreateContext = {}): Slide {
  const timestamp = now(context.now);
  return {
    id: id(context.id),
    name: 'Untitled slide',
    background: { color: '#FFFFFF' },
    elements: [],
    notes: { text: '' },
    metadata: { createdAt: timestamp, updatedAt: timestamp }
  };
}

function updateDocument(
  document: SlideDocument,
  slides: Slide[]
): SlideDocument {
  return {
    ...document,
    slides,
    metadata: { ...document.metadata, updatedAt: new Date().toISOString() }
  };
}

export function addSlide(
  document: SlideDocument,
  slide = createSlide(),
  index = document.slides.length
): SlideDocument {
  const slides = [...document.slides];
  slides.splice(Math.max(0, Math.min(index, slides.length)), 0, clone(slide));
  return updateDocument(document, slides);
}

export function duplicateSlide(
  document: SlideDocument,
  slideId: string,
  context: CreateContext = {}
): SlideDocument {
  const index = document.slides.findIndex((slide) => slide.id === slideId);
  if (index < 0) return document;
  const timestamp = now(context.now);
  const copy = clone(document.slides[index]);
  copy.id = id(context.id);
  copy.name = `${copy.name ?? 'Slide'} copy`;
  copy.metadata = { createdAt: timestamp, updatedAt: timestamp };
  copy.elements = copy.elements.map((element) => ({
    ...element,
    id: crypto.randomUUID()
  }));
  return addSlide(document, copy, index + 1);
}

export function removeSlide(
  document: SlideDocument,
  slideId: string
): SlideDocument {
  if (document.slides.length <= 1) return document;
  return updateDocument(
    document,
    document.slides.filter((slide) => slide.id !== slideId)
  );
}

export function reorderSlide(
  document: SlideDocument,
  from: number,
  to: number
): SlideDocument {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= document.slides.length ||
    to >= document.slides.length
  )
    return document;
  const slides = [...document.slides];
  const [item] = slides.splice(from, 1);
  slides.splice(to, 0, item);
  return updateDocument(document, slides);
}

export function addElement(
  document: SlideDocument,
  slideId: string,
  element: SlideElement
): SlideDocument {
  return updateSlide(document, slideId, (slide) => ({
    ...slide,
    elements: normalizeZ([
      ...slide.elements,
      { ...clone(element), zIndex: slide.elements.length }
    ])
  }));
}

export function duplicateElements(
  document: SlideDocument,
  slideId: string,
  elementIds: string[],
  options: DuplicateElementsOptions = {}
): DuplicateElementsResult {
  const slide = document.slides.find((item) => item.id === slideId);
  const selected = new Set(elementIds);
  if (!slide || !selected.size) return { document, elementIds: [] };
  const offsetX = options.offsetX ?? 160;
  const offsetY = options.offsetY ?? 160;
  const originals = [...slide.elements]
    .sort((a, b) => a.zIndex - b.zIndex)
    .filter((element) => selected.has(element.id));
  if (!originals.length) return { document, elementIds: [] };
  const copies = originals.map((element, index) => {
    const copy = clone(element);
    copy.id = options.idFactory?.(element, index) ?? crypto.randomUUID();
    copy.x += offsetX;
    copy.y += offsetY;
    copy.zIndex = slide.elements.length + index;
    if (copy.type === 'line') {
      copy.x2 += offsetX;
      copy.y2 += offsetY;
    }
    return copy;
  });
  return {
    document: updateSlide(document, slideId, (current) => ({
      ...current,
      elements: normalizeZ([...current.elements, ...copies])
    })),
    elementIds: copies.map((element) => element.id)
  };
}

export function pasteElements(
  document: SlideDocument,
  slideId: string,
  elements: SlideElement[],
  options: PasteElementsOptions = {}
): DuplicateElementsResult {
  const slide = document.slides.find((item) => item.id === slideId);
  if (!slide || !elements.length) return { document, elementIds: [] };
  const offsetX = options.offsetX ?? 160;
  const offsetY = options.offsetY ?? 160;
  const idMap = new Map(
    elements.map((element, index) => [
      element.id,
      options.idFactory?.(element, index) ?? crypto.randomUUID()
    ])
  );
  const pasted = [...elements]
    .sort((left, right) => left.zIndex - right.zIndex)
    .map((element, index) => {
      const copy = clone(element);
      copy.id = idMap.get(element.id)!;
      copy.x += offsetX;
      copy.y += offsetY;
      copy.zIndex = (options.zIndexStart ?? slide.elements.length) + index;
      if (copy.groupId) copy.groupId = idMap.get(copy.groupId);
      if (copy.type === 'group')
        copy.childIds = copy.childIds.flatMap((childId) =>
          idMap.has(childId) ? [idMap.get(childId)!] : []
        );
      if (copy.type === 'line') {
        copy.x2 += offsetX;
        copy.y2 += offsetY;
      }
      return copy;
    });
  return {
    document: updateSlide(document, slideId, (current) => ({
      ...current,
      elements: normalizeZ([...current.elements, ...pasted])
    })),
    elementIds: pasted.map((element) => element.id)
  };
}

export function pasteSlide(
  document: SlideDocument,
  source: Slide,
  index = document.slides.length,
  context: CreateContext = {}
): { document: SlideDocument; slideId: string } {
  const copy = clone(source);
  const timestamp = now(context.now);
  copy.id = id(context.id);
  copy.name = `${source.name ?? 'Slide'} copy`;
  copy.metadata = { createdAt: timestamp, updatedAt: timestamp };
  const elementIdMap = new Map(
    copy.elements.map((element) => [element.id, crypto.randomUUID()])
  );
  copy.elements = copy.elements.map((element) => ({
    ...element,
    id: elementIdMap.get(element.id)!,
    groupId: element.groupId ? elementIdMap.get(element.groupId) : undefined,
    ...(element.type === 'group'
      ? {
          childIds: element.childIds.flatMap((childId) =>
            elementIdMap.has(childId) ? [elementIdMap.get(childId)!] : []
          )
        }
      : {})
  }));
  return { document: addSlide(document, copy, index), slideId: copy.id };
}

export function updateElement(
  document: SlideDocument,
  slideId: string,
  elementId: string,
  changes: Partial<SlideElement>
): SlideDocument {
  return updateSlide(document, slideId, (slide) => ({
    ...slide,
    elements: slide.elements.map((element) =>
      element.id === elementId
        ? ({
            ...element,
            ...changes,
            id: element.id,
            type: element.type
          } as SlideElement)
        : element
    )
  }));
}

export function updateSlideNotes(
  document: SlideDocument,
  slideId: string,
  text: string
): SlideDocument {
  return updateSlide(document, slideId, (slide) => ({
    ...slide,
    notes: { text }
  }));
}

export function removeElement(
  document: SlideDocument,
  slideId: string,
  elementIds: string | string[]
): SlideDocument {
  const ids = new Set(Array.isArray(elementIds) ? elementIds : [elementIds]);
  return updateSlide(document, slideId, (slide) => ({
    ...slide,
    elements: normalizeZ(
      slide.elements.filter((element) => !ids.has(element.id))
    )
  }));
}

export function reorderElement(
  document: SlideDocument,
  slideId: string,
  elementId: string,
  to: number
): SlideDocument {
  return updateSlide(document, slideId, (slide) => {
    const items = [...slide.elements].sort((a, b) => a.zIndex - b.zIndex);
    const from = items.findIndex((item) => item.id === elementId);
    if (from < 0) return slide;
    const target = Math.max(0, Math.min(to, items.length - 1));
    if (from === target) return slide;
    const [item] = items.splice(from, 1);
    items.splice(target, 0, item);
    return {
      ...slide,
      elements: items.map((element, zIndex) => ({ ...element, zIndex }))
    };
  });
}

export function moveElementLayer(
  document: SlideDocument,
  slideId: string,
  elementId: string,
  direction: LayerDirection
): SlideDocument {
  const slide = document.slides.find((item) => item.id === slideId);
  if (!slide) return document;
  const items = [...slide.elements].sort((a, b) => a.zIndex - b.zIndex);
  const current = items.findIndex((item) => item.id === elementId);
  if (current < 0) return document;
  const target =
    direction === 'front'
      ? items.length - 1
      : direction === 'back'
        ? 0
        : direction === 'forward'
          ? current + 1
          : current - 1;
  return reorderElement(
    document,
    slideId,
    elementId,
    Math.max(0, Math.min(target, items.length - 1))
  );
}

export function normalizeZ(elements: SlideElement[]): SlideElement[] {
  return [...elements]
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((element, zIndex) => ({ ...element, zIndex }));
}

function updateSlide(
  document: SlideDocument,
  slideId: string,
  updater: (slide: Slide) => Slide
): SlideDocument {
  let changed = false;
  const slides = document.slides.map((slide) => {
    if (slide.id !== slideId) return slide;
    const updated = updater(slide);
    if (Object.is(updated, slide)) return slide;
    changed = true;
    return {
      ...updated,
      metadata: { ...updated.metadata, updatedAt: new Date().toISOString() }
    };
  });
  return changed ? updateDocument(document, slides) : document;
}
