import {
  ActiveSelection,
  cache,
  Canvas,
  Control,
  controlsUtils,
  Ellipse,
  FabricImage,
  FabricObject,
  Group,
  Line,
  Point,
  Rect,
  Textbox,
  Triangle
} from 'fabric';
import type {
  AssetReference,
  Slide,
  SlideElement,
  SlideSize,
  TextElement
} from '@slaides/slide-schema';
import {
  clearCanvasTextMetrics,
  measureCanvasTextAdvances
} from './text-metrics';

export type ElementChanges = Partial<{
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  hidden: boolean;
  locked: boolean;
  x2: number;
  y2: number;
  strokeWidth: number;
  fontSize: number;
  padding: TextPadding;
}>;
export type CanvasEvent =
  | { type: 'selectionChanged'; elementIds: string[] }
  | { type: 'elementModified'; elementId: string; changes: ElementChanges }
  | { type: 'elementTextChanged'; elementId: string; text: string }
  | { type: 'textEditingChanged'; elementId?: string; editing: boolean };
export type AssetSourceResolver = (asset: AssetReference) => string | undefined;

export interface TextPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type TextResizeHandle =
  'tl' | 'tr' | 'bl' | 'br' | 'ml' | 'mr' | 'mt' | 'mb';

export interface TextResizeSnapshot {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fontSize: number;
  lineHeight: number;
  padding: TextPadding;
  minimumFontSize: number;
}

export interface TextResizePointer {
  x: number;
  y: number;
}

export const MIN_TEXT_FONT_SIZE = 80;
export const TEXTBOX_WRAP_BY_GRAPHEME = true;

function textLayoutKey(element: TextElement): string {
  return JSON.stringify(element, (key, value) =>
    key === 'text' ? undefined : value
  );
}

export const RENDER_WIDTH = 1200;
export function domainScale(
  size: SlideSize,
  renderWidth = RENDER_WIDTH
): number {
  return renderWidth / size.width;
}
export function domainToCanvas(value: number, scale: number): number {
  return value * scale;
}
export function canvasToDomain(value: number, scale: number): number {
  return Math.round(value / scale);
}

export function zoomRenderSize(size: SlideSize, zoom: number) {
  const safeZoom = Math.max(0.25, Math.min(4, zoom));
  return {
    width: RENDER_WIDTH * safeZoom,
    height: (RENDER_WIDTH * size.height * safeZoom) / size.width
  };
}

export interface ViewOffset {
  x: number;
  y: number;
}

export function zoomOffsetAtPoint(
  currentZoom: number,
  nextZoom: number,
  offset: ViewOffset,
  pointer: ViewOffset
): ViewOffset {
  const safeCurrentZoom = Math.max(0.001, currentZoom);
  const contentPoint = {
    x: (pointer.x - offset.x) / safeCurrentZoom,
    y: (pointer.y - offset.y) / safeCurrentZoom
  };
  return {
    x: pointer.x - contentPoint.x * nextZoom,
    y: pointer.y - contentPoint.y * nextZoom
  };
}

export interface ImageLayout {
  cropX: number;
  cropY: number;
  sourceWidth: number;
  sourceHeight: number;
  scaleX: number;
  scaleY: number;
}

export function calculateImageLayout(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  fit: 'contain' | 'cover' | 'fill'
): ImageLayout {
  const safeSourceWidth = Math.max(1, sourceWidth);
  const safeSourceHeight = Math.max(1, sourceHeight);
  if (fit === 'fill') {
    return {
      cropX: 0,
      cropY: 0,
      sourceWidth: safeSourceWidth,
      sourceHeight: safeSourceHeight,
      scaleX: targetWidth / safeSourceWidth,
      scaleY: targetHeight / safeSourceHeight
    };
  }
  if (fit === 'cover') {
    const targetRatio = targetWidth / targetHeight;
    const sourceRatio = safeSourceWidth / safeSourceHeight;
    const croppedWidth =
      sourceRatio > targetRatio
        ? safeSourceHeight * targetRatio
        : safeSourceWidth;
    const croppedHeight =
      sourceRatio > targetRatio
        ? safeSourceHeight
        : safeSourceWidth / targetRatio;
    return {
      cropX: (safeSourceWidth - croppedWidth) / 2,
      cropY: (safeSourceHeight - croppedHeight) / 2,
      sourceWidth: croppedWidth,
      sourceHeight: croppedHeight,
      scaleX: targetWidth / croppedWidth,
      scaleY: targetHeight / croppedHeight
    };
  }
  const scale = Math.min(
    targetWidth / safeSourceWidth,
    targetHeight / safeSourceHeight
  );
  return {
    cropX: 0,
    cropY: 0,
    sourceWidth: safeSourceWidth,
    sourceHeight: safeSourceHeight,
    scaleX: scale,
    scaleY: scale
  };
}

export function normalizeObjectTransform(
  object: FabricObject,
  resizeContents?: (width: number, height: number) => void,
  corner?: string
): { width: number; height: number } {
  const width = Math.max(1, object.width * Math.abs(object.scaleX));
  const height = Math.max(1, object.height * Math.abs(object.scaleY));
  const [originX, originY] = fixedResizeAnchor(corner);
  const anchor = object.getPointByOrigin(originX, originY);
  if (resizeContents) resizeContents(width, height);
  else object.set({ width, height });
  object.set({ scaleX: 1, scaleY: 1 });
  object.setPositionByOrigin(anchor, originX, originY);
  object.setCoords();
  return { width, height };
}

export function calculateTextResize(
  snapshot: TextResizeSnapshot,
  pointer: TextResizePointer,
  handle: TextResizeHandle
): TextResizeSnapshot {
  const angle = (snapshot.rotation * Math.PI) / 180;
  const ux = { x: Math.cos(angle), y: Math.sin(angle) };
  const uy = { x: -Math.sin(angle), y: Math.cos(angle) };
  const center = {
    x: snapshot.x + snapshot.width / 2,
    y: snapshot.y + snapshot.height / 2
  };
  const isLeft = handle === 'ml' || handle === 'tl' || handle === 'bl';
  const isRight = handle === 'mr' || handle === 'tr' || handle === 'br';
  const isTop = handle === 'mt' || handle === 'tl' || handle === 'tr';
  const isBottom = handle === 'mb' || handle === 'bl' || handle === 'br';
  const horizontalSign = isRight ? 1 : isLeft ? -1 : 0;
  const verticalSign = isBottom ? 1 : isTop ? -1 : 0;
  const fixed = {
    x:
      center.x -
      ux.x * horizontalSign * (snapshot.width / 2) -
      uy.x * verticalSign * (snapshot.height / 2),
    y:
      center.y -
      ux.y * horizontalSign * (snapshot.width / 2) -
      uy.y * verticalSign * (snapshot.height / 2)
  };
  const delta = { x: pointer.x - fixed.x, y: pointer.y - fixed.y };
  const alongX = delta.x * ux.x + delta.y * ux.y;
  const alongY = delta.x * uy.x + delta.y * uy.y;
  let width = snapshot.width;
  let height = snapshot.height;
  let fontSize = snapshot.fontSize;
  let padding = { ...snapshot.padding };

  if (horizontalSign && verticalSign) {
    const diagonalX = horizontalSign * snapshot.width;
    const diagonalY = verticalSign * snapshot.height;
    const projectedScale =
      (alongX * diagonalX + alongY * diagonalY) /
      (snapshot.width ** 2 + snapshot.height ** 2);
    const minimumScale = Math.max(
      snapshot.minimumFontSize / snapshot.fontSize,
      0.001
    );
    const scale = Math.max(minimumScale, projectedScale);
    width = snapshot.width * scale;
    height = snapshot.height * scale;
    fontSize = snapshot.fontSize * scale;
    padding = {
      top: snapshot.padding.top * scale,
      right: snapshot.padding.right * scale,
      bottom: snapshot.padding.bottom * scale,
      left: snapshot.padding.left * scale
    };
  } else if (horizontalSign) {
    const minimumWidth = Math.max(
      1,
      snapshot.fontSize + snapshot.padding.left + snapshot.padding.right
    );
    width = Math.max(minimumWidth, alongX * horizontalSign);
  } else {
    const minimumHeight = Math.max(
      1,
      snapshot.fontSize * snapshot.lineHeight +
        snapshot.padding.top +
        snapshot.padding.bottom
    );
    height = Math.max(minimumHeight, alongY * verticalSign);
  }

  const nextCenter = {
    x:
      fixed.x +
      ux.x * horizontalSign * (width / 2) +
      uy.x * verticalSign * (height / 2),
    y:
      fixed.y +
      ux.y * horizontalSign * (width / 2) +
      uy.y * verticalSign * (height / 2)
  };
  return {
    ...snapshot,
    x: nextCenter.x - width / 2,
    y: nextCenter.y - height / 2,
    width,
    height,
    fontSize,
    padding
  };
}

function isTextResizeHandle(value?: string): value is TextResizeHandle {
  return (
    value === 'tl' ||
    value === 'tr' ||
    value === 'bl' ||
    value === 'br' ||
    value === 'ml' ||
    value === 'mr' ||
    value === 'mt' ||
    value === 'mb'
  );
}

class FramedTextbox extends Textbox {
  private frameHeight?: number;
  private naturalTextHeight = 0;
  verticalAlignMode: 'top' | 'middle' | 'bottom' = 'top';

  override initDimensions(): void {
    super.initDimensions();
    this.naturalTextHeight = this.height;
    if (this.frameHeight !== undefined) this.height = this.frameHeight;
  }

  override _measureLine(lineIndex: number) {
    const lineInfo = super._measureLine(lineIndex);
    const line = this._textLines[lineIndex];
    const bounds = this.__charBounds[lineIndex];
    if (!line?.length || !bounds || !this.isEmptyStyles(lineIndex))
      return lineInfo;

    // Fabric normally measures glyph pairs at CACHE_FONT_SIZE (400px) and
    // scales those values down. Variable/system fonts can select different
    // optical metrics at the real render size, so that approximation drifts
    // farther from the painted text at every caret boundary. Measure complete
    // prefixes with the exact font declaration used to draw this line instead.
    const fontDeclaration = this._getFontDeclaration(
      this.getCompleteStyleDeclaration(lineIndex, 0)
    );
    const advances = measureCanvasTextAdvances(
      line,
      fontDeclaration,
      this.direction
    );
    if (!advances) return lineInfo;

    for (let index = 0; index < line.length; index++) {
      const start = advances[index];
      const end = advances[index + 1];
      bounds[index].left = start;
      bounds[index].width = end - start;
      bounds[index].kernedWidth = end - start;
    }
    bounds[line.length].left = advances[line.length];
    bounds[line.length].width = 0;
    bounds[line.length].kernedWidth = 0;
    lineInfo.width = advances[line.length];
    return lineInfo;
  }

  setFrameHeight(height: number): void {
    this.frameHeight = Math.max(1, height);
    this.height = this.frameHeight;
  }

  override _getTopOffset(): number {
    const top = -this.height / 2;
    const remaining = Math.max(0, this.height - this.naturalTextHeight);
    if (this.verticalAlignMode === 'middle') return top + remaining / 2;
    if (this.verticalAlignMode === 'bottom') return top + remaining;
    return top;
  }

  override _render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.beginPath();
    ctx.rect(-this.width / 2, -this.height / 2, this.width, this.height);
    ctx.clip();
    super._render(ctx);
    ctx.restore();
  }
}

export function unrotatedFramePosition(
  object: FabricObject,
  width: number,
  height: number
): { x: number; y: number } {
  const center = object.getCenterPoint();
  return {
    x: center.x - width / 2,
    y: center.y - height / 2
  };
}

export function applyLineGeometry(
  line: Line,
  geometry: { x: number; y: number; x2: number; y2: number }
): void {
  // Fabric recalculates left/top when line endpoints change. Endpoints must be
  // applied first so the authoritative document position can win afterwards.
  line.set({
    x1: 0,
    y1: 0,
    x2: geometry.x2 - geometry.x,
    y2: geometry.y2 - geometry.y
  });
  line.set({ left: geometry.x, top: geometry.y });
}

function fixedResizeAnchor(
  corner?: string
): ['left' | 'center' | 'right', 'top' | 'center' | 'bottom'] {
  if (corner === 'tl') return ['right', 'bottom'];
  if (corner === 'tr') return ['left', 'bottom'];
  if (corner === 'bl') return ['right', 'top'];
  if (corner === 'br') return ['left', 'top'];
  if (corner === 'ml') return ['right', 'center'];
  if (corner === 'mr') return ['left', 'center'];
  if (corner === 'mt') return ['center', 'bottom'];
  if (corner === 'mb') return ['center', 'top'];
  return ['center', 'center'];
}

export function normalizeLineTransform(
  line: Line,
  corner?: string
): {
  x: number;
  y: number;
  x2: number;
  y2: number;
  strokeWidth: number;
} {
  const [originX, originY] =
    corner === 'mt' || corner === 'mb'
      ? (['center', 'center'] as const)
      : fixedResizeAnchor(corner);
  const anchor = line.getPointByOrigin(originX, originY);
  const x2 = (line.x2 - line.x1) * Math.abs(line.scaleX);
  const y2 = (line.y2 - line.y1) * Math.abs(line.scaleY);
  line.set({ x1: 0, y1: 0, x2, y2, scaleX: 1, scaleY: 1 });
  line.setPositionByOrigin(anchor, originX, originY);
  line.setCoords();
  return {
    x: line.left,
    y: line.top,
    x2: line.left + x2,
    y2: line.top + y2,
    strokeWidth: Math.max(0.5, line.strokeWidth ?? 1)
  };
}

export interface CanvasControllerOptions {
  size: SlideSize;
  onEvent: (event: CanvasEvent) => void;
  resolveAsset?: AssetSourceResolver;
}

export class CanvasController {
  static mount(
    element: HTMLCanvasElement,
    options: CanvasControllerOptions
  ): CanvasController {
    return new CanvasController(element, options);
  }
  readonly canvas: Canvas;
  private readonly options: CanvasControllerOptions;
  private readonly objects = new Map<string, FabricObject>();
  private readonly ids = new WeakMap<FabricObject, string>();
  private renderVersion = 0;
  private disposed = false;
  private zoom = 1;
  private applyingSelection = 0;
  private requestedSelection: string[] = [];
  private slideId: string | undefined;
  private readonly imageParts = new WeakMap<
    FabricObject,
    {
      frame: Rect;
      image: FabricImage;
      fit: 'contain' | 'cover' | 'fill';
    }
  >();
  private readonly textFrames = new WeakMap<Textbox, TextResizeSnapshot>();
  private readonly textLayoutKeys = new WeakMap<Textbox, string>();
  private readonly textResizeStarts = new WeakMap<
    Textbox,
    TextResizeSnapshot
  >();
  private readonly lineGeometry = new WeakMap<
    Line,
    { x: number; y: number; x2: number; y2: number }
  >();

  private constructor(
    element: HTMLCanvasElement,
    options: CanvasControllerOptions
  ) {
    this.options = options;
    const height = (RENDER_WIDTH * options.size.height) / options.size.width;
    this.canvas = new Canvas(element, {
      width: RENDER_WIDTH,
      height,
      backgroundColor: '#fff',
      preserveObjectStacking: true,
      selection: true,
      centeredScaling: false,
      uniformScaling: false
    });
    this.canvas.on('selection:created', () => this.emitSelection());
    this.canvas.on('selection:updated', () => this.emitSelection());
    this.canvas.on('selection:cleared', () => this.emitSelection());
    this.canvas.on('object:modified', ({ target, transform }) => {
      if (target && !(target instanceof ActiveSelection))
        this.emitModified(target, transform?.corner);
      else if (target instanceof ActiveSelection)
        target.getObjects().forEach((object) => this.emitModified(object));
    });
    this.canvas.on('text:changed', ({ target }) => {
      if (target instanceof Textbox) {
        const frame = this.textFrames.get(target);
        if (frame) {
          if (target instanceof FramedTextbox)
            target.setFrameHeight(frame.height);
          else target.set('height', frame.height);
        }
        const elementId = this.ids.get(target);
        if (elementId)
          options.onEvent({
            type: 'elementTextChanged',
            elementId,
            text: target.text
          });
      }
    });
    this.canvas.on('text:editing:entered', ({ target }) => {
      options.onEvent({
        type: 'textEditingChanged',
        elementId: target ? this.ids.get(target) : undefined,
        editing: true
      });
    });
    this.canvas.on('text:editing:exited', ({ target }) => {
      options.onEvent({
        type: 'textEditingChanged',
        elementId: target ? this.ids.get(target) : undefined,
        editing: false
      });
    });
  }

  async replaceSlide(
    slide: Slide,
    assets: AssetReference[] = []
  ): Promise<void> {
    const version = ++this.renderVersion;
    this.slideId = slide.id;
    this.applyingSelection++;
    try {
      this.canvas.discardActiveObject();
      this.canvas.clear();
      this.canvas.backgroundColor = slide.background.color;
      this.objects.clear();
      const assetMap = new Map(assets.map((asset) => [asset.id, asset]));
      for (const element of [...slide.elements].sort(
        (a, b) => a.zIndex - b.zIndex
      )) {
        const object = await this.toFabricObject(element, assetMap);
        if (this.disposed || version !== this.renderVersion) return;
        if (object) this.addObject(element.id, object);
      }
    } finally {
      this.applyingSelection--;
    }
    this.setSelection(this.requestedSelection);
    this.canvas.requestRenderAll();
  }

  async renderSlide(
    slide: Slide,
    assets: AssetReference[] = []
  ): Promise<void> {
    await this.replaceSlide(slide, assets);
  }

  async reconcileSlide(
    slide: Slide,
    assets: AssetReference[] = []
  ): Promise<void> {
    if (this.slideId !== slide.id) {
      await this.replaceSlide(slide, assets);
      return;
    }
    const version = ++this.renderVersion;
    const assetMap = new Map(assets.map((asset) => [asset.id, asset]));
    const domainIds = new Set(slide.elements.map((element) => element.id));
    this.applyingSelection++;
    try {
      for (const [elementId, object] of this.objects) {
        if (!domainIds.has(elementId)) {
          this.canvas.remove(object);
          this.objects.delete(elementId);
        }
      }
      for (const element of [...slide.elements].sort(
        (a, b) => a.zIndex - b.zIndex
      )) {
        const current = this.objects.get(element.id);
        if (current && !this.needsReplacement(current, element)) {
          // Fabric already owns the up-to-date glyph metrics, wrapped lines and
          // caret cache while a textbox is being edited. The text-change event
          // writes that same text to the domain model; applying the resulting
          // store update back onto the textbox would rebuild its dimensions on
          // every keystroke. With longer text this leaves the caret boundaries
          // one layout behind the rendered glyphs, so the caret overlaps them.
          const isTextEcho =
            element.type === 'text' &&
            current instanceof Textbox &&
            current.isEditing &&
            current.text === element.text &&
            this.textLayoutKeys.get(current) === textLayoutKey(element);
          if (!isTextEcho) this.updateFabricObject(current, element);
        } else {
          const object = await this.toFabricObject(element, assetMap);
          if (this.disposed || version !== this.renderVersion) return;
          if (!object) continue;
          if (current) {
            const wasSelected = this.canvas
              .getActiveObjects()
              .includes(current);
            this.canvas.remove(current);
            this.objects.delete(element.id);
            this.addObject(element.id, object);
            if (wasSelected && !this.requestedSelection.includes(element.id))
              this.requestedSelection = [
                ...this.requestedSelection,
                element.id
              ];
          } else this.addObject(element.id, object);
        }
        const object = this.objects.get(element.id);
        if (object) this.canvas.moveObjectTo(object, element.zIndex);
      }
      this.canvas.backgroundColor = slide.background.color;
    } finally {
      this.applyingSelection--;
    }
    this.setSelection(this.requestedSelection);
    this.canvas.requestRenderAll();
  }

  setSelection(ids: string[]): void {
    this.requestedSelection = [...new Set(ids)];
    const objects = ids
      .map((id) => this.objects.get(id))
      .filter(Boolean) as FabricObject[];
    const currentIds = this.canvas
      .getActiveObjects()
      .map((object) => this.ids.get(object))
      .filter(Boolean) as string[];
    if (
      currentIds.length === objects.length &&
      currentIds.every((id) => ids.includes(id))
    )
      return;
    this.applyingSelection++;
    try {
      this.canvas.discardActiveObject();
      if (objects.length === 1) this.canvas.setActiveObject(objects[0]);
      else if (objects.length > 1)
        this.canvas.setActiveObject(
          new ActiveSelection(objects, { canvas: this.canvas })
        );
    } finally {
      this.applyingSelection--;
    }
    this.canvas.requestRenderAll();
  }
  setZoom(value: number): void {
    this.zoom = Math.max(0.25, Math.min(4, value));
    this.canvas.setDimensions(zoomRenderSize(this.options.size, this.zoom));
    this.canvas.setViewportTransform([this.zoom, 0, 0, this.zoom, 0, 0]);
    this.canvas.requestRenderAll();
  }
  getZoom(): number {
    return this.zoom;
  }
  panBy(x: number, y: number): void {
    this.canvas.relativePan(new Point(x, y));
  }
  resetViewport(): void {
    this.canvas.setViewportTransform([this.zoom, 0, 0, this.zoom, 0, 0]);
    this.canvas.requestRenderAll();
  }
  dispose(): void {
    this.disposed = true;
    this.renderVersion++;
    this.objects.clear();
    this.canvas.dispose();
  }

  private emitSelection(): void {
    if (this.applyingSelection) return;
    const elementIds = this.canvas
      .getActiveObjects()
      .map((object) => this.ids.get(object))
      .filter(Boolean) as string[];
    this.requestedSelection = elementIds;
    this.options.onEvent({
      type: 'selectionChanged',
      elementIds
    });
  }

  private addObject(elementId: string, object: FabricObject): void {
    this.ids.set(object, elementId);
    this.objects.set(elementId, object);
    this.canvas.add(object);
  }

  private needsReplacement(
    object: FabricObject,
    element: SlideElement
  ): boolean {
    if (element.type === 'shape') {
      if (element.shapeType === 'ellipse') return !(object instanceof Ellipse);
      if (element.shapeType === 'triangle')
        return !(object instanceof Triangle);
      return !(object instanceof Rect) || object instanceof FabricImage;
    }
    if (element.type === 'text') return !(object instanceof FramedTextbox);
    if (element.type === 'line') return !(object instanceof Line);
    if (element.type === 'image') return !(object instanceof Group);
    return true;
  }

  private updateFabricObject(
    object: FabricObject,
    element: SlideElement
  ): void {
    const scale = domainScale(this.options.size);
    const isLine = element.type === 'line' && object instanceof Line;
    const common = {
      left: isLine
        ? domainToCanvas(element.x, scale)
        : domainToCanvas(element.x + element.width / 2, scale),
      top: isLine
        ? domainToCanvas(element.y, scale)
        : domainToCanvas(element.y + element.height / 2, scale),
      originX: isLine ? ('left' as const) : ('center' as const),
      originY: isLine ? ('top' as const) : ('center' as const),
      angle: element.rotation,
      opacity: element.opacity,
      visible: !element.hidden,
      selectable: !element.locked,
      evented: !element.locked,
      lockMovementX: element.locked,
      lockMovementY: element.locked,
      strokeUniform: true
    };
    if (!isLine) object.set(common);
    if (element.type === 'text' && object instanceof Textbox) {
      this.ensureFontLoaded(
        element.fontFamily,
        element.fontSize,
        element.fontWeight,
        element.fontStyle,
        element.text,
        object
      );
      const selectionStart = object.selectionStart;
      const selectionEnd = object.selectionEnd;
      if (object.text !== element.text) object.set('text', element.text);
      object.set({
        fontFamily: element.fontFamily,
        fontWeight: element.fontWeight,
        fontStyle: element.fontStyle,
        fill: element.color,
        textAlign: element.horizontalAlign,
        lineHeight: element.lineHeight
      });
      if (object instanceof FramedTextbox)
        object.verticalAlignMode = element.verticalAlign;
      this.applyTextFrame(object, this.textFrameFromElement(element, scale));
      this.textLayoutKeys.set(object, textLayoutKey(element));
      if (object.isEditing) {
        object.selectionStart = selectionStart;
        object.selectionEnd = selectionEnd;
      }
    } else if (element.type === 'shape') {
      object.set({
        fill: element.fill,
        stroke: element.stroke,
        strokeWidth: domainToCanvas(element.strokeWidth, scale)
      });
      if (object instanceof Ellipse)
        object.set({
          rx: domainToCanvas(element.width, scale) / 2,
          ry: domainToCanvas(element.height, scale) / 2
        });
      else
        object.set({
          width: domainToCanvas(element.width, scale),
          height: domainToCanvas(element.height, scale),
          rx: domainToCanvas(element.cornerRadius ?? 0, scale),
          ry: domainToCanvas(element.cornerRadius ?? 0, scale)
        });
    } else if (element.type === 'line' && object instanceof Line) {
      const x = domainToCanvas(element.x, scale);
      const y = domainToCanvas(element.y, scale);
      const x2 = domainToCanvas(element.x2, scale);
      const y2 = domainToCanvas(element.y2, scale);
      applyLineGeometry(object, { x, y, x2, y2 });
      object.set({
        ...common,
        stroke: element.stroke,
        strokeWidth: domainToCanvas(element.strokeWidth, scale),
        strokeDashArray: element.dash?.map((value) =>
          domainToCanvas(value, scale)
        )
      });
      this.lineGeometry.set(object, { x, y, x2, y2 });
    } else if (element.type === 'image' && object instanceof Group) {
      const width = domainToCanvas(element.width, scale);
      const height = domainToCanvas(element.height, scale);
      const parts = this.imageParts.get(object);
      if (parts) {
        this.layoutImage(parts.frame, parts.image, width, height, element.fit);
        parts.fit = element.fit;
        object.triggerLayout();
        // Group layout preserves its center and may therefore rewrite left/top.
        // Domain coordinates are authoritative during reconciliation.
        object.set({
          ...common,
          left: domainToCanvas(element.x + element.width / 2, scale),
          top: domainToCanvas(element.y + element.height / 2, scale),
          scaleX: 1,
          scaleY: 1
        });
      }
    }
    object.setCoords();
  }
  private emitModified(object: FabricObject, corner?: string): void {
    const elementId = this.ids.get(object);
    if (!elementId) return;
    const scale = domainScale(this.options.size);
    if (object instanceof Line) {
      if (corner === 'mt' || corner === 'mb') {
        const geometry = this.lineGeometry.get(object);
        if (geometry) {
          this.options.onEvent({
            type: 'elementModified',
            elementId,
            changes: {
              x: canvasToDomain(geometry.x, scale),
              y: canvasToDomain(geometry.y, scale),
              x2: canvasToDomain(geometry.x2, scale),
              y2: canvasToDomain(geometry.y2, scale),
              width: canvasToDomain(geometry.x2 - geometry.x, scale),
              height: canvasToDomain(geometry.y2 - geometry.y, scale),
              strokeWidth: canvasToDomain(
                Math.max(0.5, object.strokeWidth ?? 1),
                scale
              ),
              rotation: Math.round((object.angle ?? 0) * 100) / 100
            }
          });
          return;
        }
      }
      const line = normalizeLineTransform(object, corner);
      this.lineGeometry.set(object, {
        x: line.x,
        y: line.y,
        x2: line.x2,
        y2: line.y2
      });
      this.options.onEvent({
        type: 'elementModified',
        elementId,
        changes: {
          x: canvasToDomain(line.x, scale),
          y: canvasToDomain(line.y, scale),
          x2: canvasToDomain(line.x2, scale),
          y2: canvasToDomain(line.y2, scale),
          width: canvasToDomain(line.x2 - line.x, scale),
          height: canvasToDomain(line.y2 - line.y, scale),
          strokeWidth: canvasToDomain(line.strokeWidth, scale),
          rotation: Math.round((object.angle ?? 0) * 100) / 100
        }
      });
      return;
    }
    if (object instanceof Textbox) {
      const cached = this.textFrames.get(object);
      if (!cached) return;
      const center = object.getCenterPoint();
      const resized = isTextResizeHandle(corner);
      const frame: TextResizeSnapshot = {
        ...cached,
        x: resized ? cached.x : center.x - cached.width / 2,
        y: resized ? cached.y : center.y - cached.height / 2,
        rotation: Math.round((object.angle ?? 0) * 100) / 100
      };
      this.textFrames.set(object, frame);
      this.options.onEvent({
        type: 'elementModified',
        elementId,
        changes: {
          x: canvasToDomain(frame.x, scale),
          y: canvasToDomain(frame.y, scale),
          width: canvasToDomain(frame.width, scale),
          height: canvasToDomain(frame.height, scale),
          rotation: frame.rotation,
          fontSize: canvasToDomain(frame.fontSize, scale),
          padding: this.paddingToDomain(frame.padding, scale)
        }
      });
      return;
    }
    const imageGroup = object instanceof Group ? object : null;
    const parts = imageGroup ? this.imageParts.get(imageGroup) : null;
    const { width, height } = normalizeObjectTransform(
      object,
      parts
        ? (nextWidth, nextHeight) => {
            this.layoutImage(
              parts.frame,
              parts.image,
              nextWidth,
              nextHeight,
              parts.fit
            );
            imageGroup?.triggerLayout();
          }
        : undefined,
      corner
    );
    const position = unrotatedFramePosition(object, width, height);
    this.options.onEvent({
      type: 'elementModified',
      elementId,
      changes: {
        // Domain x/y describe the unrotated frame's top-left. Fabric rotates
        // around the object centre, so persisting Fabric's left/top would make
        // the coordinates drift whenever the angle changes.
        x: canvasToDomain(position.x, scale),
        y: canvasToDomain(position.y, scale),
        width: canvasToDomain(width, scale),
        height: canvasToDomain(height, scale),
        rotation: Math.round((object.angle ?? 0) * 100) / 100
      }
    });
  }

  private async toFabricObject(
    element: SlideElement,
    assets: Map<string, AssetReference>
  ): Promise<FabricObject | undefined> {
    if (element.type === 'group') return undefined;
    const scale = domainScale(this.options.size);
    const common = {
      left: domainToCanvas(element.x + element.width / 2, scale),
      top: domainToCanvas(element.y + element.height / 2, scale),
      width: domainToCanvas(element.width, scale),
      height: domainToCanvas(element.height, scale),
      angle: element.rotation,
      opacity: element.opacity,
      visible: !element.hidden,
      selectable: !element.locked,
      evented: !element.locked,
      lockMovementX: element.locked,
      lockMovementY: element.locked,
      originX: 'center' as const,
      originY: 'center' as const,
      borderColor: '#0a84ff',
      cornerColor: '#f8fafc',
      cornerStrokeColor: '#007aff',
      transparentCorners: false,
      centeredScaling: false,
      lockScalingFlip: true,
      minScaleLimit: 0.02,
      strokeUniform: true
    };
    if (element.type === 'text') {
      await this.loadFont(
        element.fontFamily,
        element.fontSize,
        element.fontWeight,
        element.fontStyle,
        element.text
      );
      const textbox = new FramedTextbox(element.text, {
        ...common,
        fontFamily: element.fontFamily,
        fontSize: domainToCanvas(element.fontSize, scale),
        fontWeight: element.fontWeight,
        fontStyle: element.fontStyle,
        fill: element.color,
        textAlign: element.horizontalAlign,
        lineHeight: element.lineHeight,
        // Fabric treats an unspaced Japanese sentence as one unbreakable word
        // unless grapheme wrapping is enabled, which makes the internal width
        // grow beyond the authoritative document frame and offsets the caret.
        splitByGrapheme: TEXTBOX_WRAP_BY_GRAPHEME
      });
      textbox.verticalAlignMode = element.verticalAlign;
      this.configureTextControls(textbox);
      this.applyTextFrame(textbox, this.textFrameFromElement(element, scale));
      this.textLayoutKeys.set(textbox, textLayoutKey(element));
      return textbox;
    }
    if (element.type === 'shape') {
      const props = {
        ...common,
        fill: element.fill,
        stroke: element.stroke,
        strokeWidth: domainToCanvas(element.strokeWidth, scale),
        rx: domainToCanvas(element.cornerRadius ?? 0, scale),
        ry: domainToCanvas(element.cornerRadius ?? 0, scale)
      };
      if (element.shapeType === 'ellipse')
        return new Ellipse({
          ...props,
          rx: common.width / 2,
          ry: common.height / 2,
          width: undefined,
          height: undefined
        });
      if (element.shapeType === 'triangle') return new Triangle(props);
      return new Rect(props);
    }
    if (element.type === 'line') {
      const line = new Line(
        [
          0,
          0,
          domainToCanvas(element.x2 - element.x, scale),
          domainToCanvas(element.y2 - element.y, scale)
        ],
        {
          ...common,
          left: domainToCanvas(element.x, scale),
          top: domainToCanvas(element.y, scale),
          originX: 'left',
          originY: 'top',
          width: undefined,
          height: undefined,
          fill: element.stroke,
          stroke: element.stroke,
          strokeWidth: domainToCanvas(element.strokeWidth, scale),
          strokeDashArray: element.dash?.map((value) =>
            domainToCanvas(value, scale)
          )
        }
      );
      line.setControlsVisibility({
        tl: false,
        tr: false,
        bl: false,
        br: false
      });
      line.controls.mt = this.createLineThicknessControl(-1);
      line.controls.mb = this.createLineThicknessControl(1);
      this.lineGeometry.set(line, {
        x: common.left,
        y: common.top,
        x2: common.left + domainToCanvas(element.x2 - element.x, scale),
        y2: common.top + domainToCanvas(element.y2 - element.y, scale)
      });
      return line;
    }
    const asset = assets.get(element.assetId);
    const source = asset && this.options.resolveAsset?.(asset);
    if (!source)
      return new Rect({
        ...common,
        fill: '#1e293b',
        stroke: '#475569',
        strokeDashArray: [8, 8]
      });
    const image = await FabricImage.fromURL(source);
    const frame = new Rect({
      left: 0,
      top: 0,
      width: common.width,
      height: common.height,
      originX: 'center',
      originY: 'center',
      fill: 'rgba(0,0,0,0.001)',
      strokeWidth: 0,
      selectable: false,
      evented: false
    });
    this.layoutImage(frame, image, common.width, common.height, element.fit);
    const group = new Group([frame, image], {
      ...common,
      width: undefined,
      height: undefined,
      subTargetCheck: false
    });
    this.imageParts.set(group, { frame, image, fit: element.fit });
    return group;
  }

  private textFrameFromElement(
    element: TextElement,
    scale: number
  ): TextResizeSnapshot {
    return {
      x: domainToCanvas(element.x, scale),
      y: domainToCanvas(element.y, scale),
      width: domainToCanvas(element.width, scale),
      height: domainToCanvas(element.height, scale),
      rotation: element.rotation,
      fontSize: domainToCanvas(element.fontSize, scale),
      lineHeight: element.lineHeight,
      padding: {
        top: domainToCanvas(element.padding.top, scale),
        right: domainToCanvas(element.padding.right, scale),
        bottom: domainToCanvas(element.padding.bottom, scale),
        left: domainToCanvas(element.padding.left, scale)
      },
      minimumFontSize: domainToCanvas(MIN_TEXT_FONT_SIZE, scale)
    };
  }

  private paddingToDomain(padding: TextPadding, scale: number): TextPadding {
    return {
      top: canvasToDomain(padding.top, scale),
      right: canvasToDomain(padding.right, scale),
      bottom: canvasToDomain(padding.bottom, scale),
      left: canvasToDomain(padding.left, scale)
    };
  }

  private applyTextFrame(textbox: Textbox, frame: TextResizeSnapshot): void {
    if (textbox instanceof FramedTextbox) textbox.setFrameHeight(frame.height);
    textbox.set({
      width: frame.width,
      fontSize: frame.fontSize,
      left: frame.x + frame.width / 2,
      top: frame.y + frame.height / 2,
      angle: frame.rotation,
      originX: 'center',
      originY: 'center',
      scaleX: 1,
      scaleY: 1
    });
    if (textbox instanceof FramedTextbox) textbox.setFrameHeight(frame.height);
    else textbox.set('height', frame.height);
    textbox.setCoords();
    this.textFrames.set(textbox, {
      ...frame,
      padding: { ...frame.padding }
    });
  }

  private configureTextControls(textbox: Textbox): void {
    const positions: Record<TextResizeHandle, { x: number; y: number }> = {
      tl: { x: -0.5, y: -0.5 },
      tr: { x: 0.5, y: -0.5 },
      bl: { x: -0.5, y: 0.5 },
      br: { x: 0.5, y: 0.5 },
      ml: { x: -0.5, y: 0 },
      mr: { x: 0.5, y: 0 },
      mt: { x: 0, y: -0.5 },
      mb: { x: 0, y: 0.5 }
    };
    for (const handle of Object.keys(positions) as TextResizeHandle[]) {
      const position = positions[handle];
      textbox.controls[handle] = new Control({
        ...position,
        actionName: 'textResize',
        cursorStyleHandler: controlsUtils.scaleCursorStyleHandler,
        mouseDownHandler: (_event, transform) => {
          if (!(transform.target instanceof Textbox)) return false;
          const frame = this.textFrames.get(transform.target);
          if (!frame) return false;
          this.textResizeStarts.set(transform.target, {
            ...frame,
            rotation: transform.target.angle ?? frame.rotation,
            padding: { ...frame.padding }
          });
          return true;
        },
        actionHandler: (_event, transform, x, y) => {
          if (!(transform.target instanceof Textbox)) return false;
          const start = this.textResizeStarts.get(transform.target);
          if (!start) return false;
          const frame = calculateTextResize(start, { x, y }, handle);
          this.applyTextFrame(transform.target, frame);
          this.canvas.requestRenderAll();
          return true;
        },
        mouseUpHandler: (_event, transform) => {
          if (transform.target instanceof Textbox)
            this.textResizeStarts.delete(transform.target);
          return true;
        }
      });
    }
  }

  private createLineThicknessControl(direction: -1 | 1): Control {
    let start:
      { x: number; y: number; strokeWidth: number; angle: number } | undefined;
    return new Control({
      x: 0,
      y: 0,
      offsetY: direction * 16,
      cursorStyle: 'ns-resize',
      actionName: 'changeStrokeWidth',
      mouseDownHandler: (_event, transform, x, y) => {
        start = {
          x,
          y,
          strokeWidth: transform.target.strokeWidth ?? 1,
          angle: ((transform.target.angle ?? 0) * Math.PI) / 180
        };
        return true;
      },
      actionHandler: (_event, transform, x, y) => {
        if (!start) return false;
        const deltaX = x - start.x;
        const deltaY = y - start.y;
        const localY =
          -deltaX * Math.sin(start.angle) + deltaY * Math.cos(start.angle);
        transform.target.set(
          'strokeWidth',
          Math.max(0.5, start.strokeWidth + direction * localY)
        );
        transform.target.setCoords();
        return true;
      },
      mouseUpHandler: () => {
        start = undefined;
        return true;
      }
    });
  }

  private layoutImage(
    frame: Rect,
    image: FabricImage,
    width: number,
    height: number,
    fit: 'contain' | 'cover' | 'fill'
  ): void {
    const sourceWidth = image.getOriginalSize().width || image.width || 1;
    const sourceHeight = image.getOriginalSize().height || image.height || 1;
    frame.set({ width, height, left: 0, top: 0 });
    image.set({
      left: 0,
      top: 0,
      originX: 'center',
      originY: 'center',
      cropX: 0,
      cropY: 0,
      width: sourceWidth,
      height: sourceHeight
    });
    const layout = calculateImageLayout(
      sourceWidth,
      sourceHeight,
      width,
      height,
      fit
    );
    image.set({
      cropX: layout.cropX,
      cropY: layout.cropY,
      width: layout.sourceWidth,
      height: layout.sourceHeight,
      scaleX: layout.scaleX,
      scaleY: layout.scaleY
    });
  }

  private fontDescriptor(
    fontFamily: string,
    fontSize: number,
    fontWeight: string | number = 'normal',
    fontStyle = 'normal'
  ): string {
    const cleanedFamily = fontFamily.replaceAll('"', '').trim();
    const genericFamilies = new Set([
      'system-ui',
      'ui-sans-serif',
      'ui-serif',
      'ui-monospace',
      'sans-serif',
      'serif',
      'monospace'
    ]);
    const cssFamily = genericFamilies.has(cleanedFamily)
      ? cleanedFamily
      : `"${cleanedFamily}"`;
    return `${fontStyle} ${fontWeight} ${Math.max(1, fontSize)}px ${cssFamily}`;
  }

  private async loadFont(
    fontFamily: string,
    fontSize: number,
    fontWeight?: string | number,
    fontStyle?: string,
    text = 'BESbswy'
  ): Promise<void> {
    if (typeof document === 'undefined' || !document.fonts) return;
    const descriptor = this.fontDescriptor(
      fontFamily,
      fontSize,
      fontWeight,
      fontStyle
    );
    if (!document.fonts.check(descriptor, text)) {
      await document.fonts.load(descriptor, text);
      cache.clearFontCache(fontFamily);
      clearCanvasTextMetrics();
    }
  }

  private ensureFontLoaded(
    fontFamily: string,
    fontSize: number,
    fontWeight: string | number,
    fontStyle: string,
    text: string,
    textbox: Textbox
  ): void {
    if (typeof document === 'undefined' || !document.fonts) return;
    const descriptor = this.fontDescriptor(
      fontFamily,
      fontSize,
      fontWeight,
      fontStyle
    );
    if (document.fonts.check(descriptor, text)) return;
    void document.fonts.load(descriptor, text).then(() => {
      if (
        this.disposed ||
        textbox.fontFamily !== fontFamily ||
        String(textbox.fontWeight) !== String(fontWeight) ||
        textbox.fontStyle !== fontStyle
      )
        return;
      cache.clearFontCache(fontFamily);
      clearCanvasTextMetrics();
      const frame = this.textFrames.get(textbox);
      const selectionStart = textbox.selectionStart;
      const selectionEnd = textbox.selectionEnd;
      textbox.initDimensions();
      if (frame) this.applyTextFrame(textbox, frame);
      if (textbox.isEditing) {
        textbox.setSelectionStart(selectionStart);
        textbox.setSelectionEnd(selectionEnd);
      }
      textbox.setCoords();
      this.canvas.requestRenderAll();
    });
  }
}
