import type {
  BaseSlideElement,
  ImageElement,
  LineElement,
  ShapeElement,
  Slide,
  SlideDocument,
  SlideElement,
  SlideElementType,
  TextElement
} from '@slaides/slide-schema';

export interface CreateContext {
  id?: string;
  now?: string;
  assetId?: string;
}

export type LayerDirection = 'front' | 'forward' | 'backward' | 'back';

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
      fontFamily: 'system-ui',
      fontSize: 360,
      fontWeight: 600,
      fontStyle: 'normal',
      color: '#111827',
      horizontalAlign: 'center',
      verticalAlign: 'middle',
      lineHeight: 1.2,
      letterSpacing: 0,
      autoFit: 'none',
      padding: { top: 80, right: 80, bottom: 80, left: 80 }
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
    const [item] = items.splice(from, 1);
    items.splice(Math.max(0, Math.min(to, items.length)), 0, item);
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
    changed = true;
    const updated = updater(slide);
    return {
      ...updated,
      metadata: { ...updated.metadata, updatedAt: new Date().toISOString() }
    };
  });
  return changed ? updateDocument(document, slides) : document;
}
