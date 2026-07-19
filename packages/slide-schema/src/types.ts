export interface SlideSize {
  width: number;
  height: number;
  unit: 'slaides-unit';
}

export interface SlideTheme {
  colors: {
    background: string;
    foreground: string;
    primary: string;
    secondary: string;
    accent: string;
  };
  fonts: {
    heading: string;
    body: string;
    monospace: string;
  };
}

export interface DocumentMetadata {
  createdAt: string;
  updatedAt: string;
}

export interface SlideMetadata {
  createdAt: string;
  updatedAt: string;
}

export interface SlideBackground {
  color: string;
}

export interface SpeakerNotes {
  text: string;
}

export interface AssetReference {
  id: string;
  kind: 'image';
  hash: string;
  filename: string;
  mimeType: string;
  width?: number;
  height?: number;
  localPath: string;
  createdAt: string;
}

export type SlideElementType = 'text' | 'image' | 'shape' | 'line' | 'group';

export interface BaseSlideElement {
  id: string;
  type: SlideElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  zIndex: number;
  locked: boolean;
  hidden: boolean;
  groupId?: string;
  metadata?: Record<string, unknown>;
}

export interface TextElement extends BaseSlideElement {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  color: string;
  horizontalAlign: 'left' | 'center' | 'right' | 'justify';
  verticalAlign: 'top' | 'middle' | 'bottom';
  lineHeight: number;
  letterSpacing: number;
  autoFit: 'none' | 'shrink' | 'resize-height';
  padding: { top: number; right: number; bottom: number; left: number };
  textStyles?: TextStyleRange[];
}

export interface TextStyleAttributes {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  fontStyle?: 'normal' | 'italic';
  color?: string;
}

export interface TextStyleRange extends TextStyleAttributes {
  /** Grapheme-based start index, inclusive. */
  start: number;
  /** Grapheme-based end index, exclusive. */
  end: number;
}

export interface ImageElement extends BaseSlideElement {
  type: 'image';
  assetId: string;
  fit: 'contain' | 'cover' | 'fill';
  crop?: { x: number; y: number; width: number; height: number };
  borderRadius?: number;
}

export interface ShapeElement extends BaseSlideElement {
  type: 'shape';
  shapeType: 'rectangle' | 'rounded-rectangle' | 'ellipse' | 'triangle';
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius?: number;
}

export interface LineElement extends BaseSlideElement {
  type: 'line';
  x2: number;
  y2: number;
  stroke: string;
  strokeWidth: number;
  dash?: number[];
  startArrow?: 'none' | 'triangle';
  endArrow?: 'none' | 'triangle';
}

export interface GroupElement extends BaseSlideElement {
  type: 'group';
  childIds: string[];
}

export type SlideElement =
  TextElement | ImageElement | ShapeElement | LineElement | GroupElement;

export interface Slide {
  id: string;
  name?: string;
  background: SlideBackground;
  elements: SlideElement[];
  notes?: SpeakerNotes;
  metadata: SlideMetadata;
}

export interface SlideDocument {
  schemaVersion: number;
  id: string;
  title: string;
  description?: string;
  size: SlideSize;
  theme: SlideTheme;
  slides: Slide[];
  assets: AssetReference[];
  metadata: DocumentMetadata;
}

export interface DocumentMigrator {
  canMigrate(fromVersion: number): boolean;
  migrate(input: unknown): unknown;
}
