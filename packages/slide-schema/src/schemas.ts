import { z } from 'zod';
import { CURRENT_SCHEMA_VERSION } from './defaults';

const finiteNumber = z.number().finite();
const nonNegativeNumber = finiteNumber.nonnegative();
const positiveNumber = finiteNumber.positive();
const uuid = z.uuid();
const timestamp = z.iso.datetime({ offset: true });
const color = z.string().min(1);

export const SlideSizeSchema = z.strictObject({
  width: positiveNumber,
  height: positiveNumber,
  unit: z.literal('slaides-unit')
});

export const SlideThemeSchema = z.strictObject({
  colors: z.strictObject({
    background: color,
    foreground: color,
    primary: color,
    secondary: color,
    accent: color
  }),
  fonts: z.strictObject({
    heading: z.string().min(1),
    body: z.string().min(1),
    monospace: z.string().min(1)
  })
});

export const DocumentMetadataSchema = z.strictObject({
  createdAt: timestamp,
  updatedAt: timestamp
});

export const SlideMetadataSchema = z.strictObject({
  createdAt: timestamp,
  updatedAt: timestamp
});

export const SlideBackgroundSchema = z.strictObject({ color });
export const SpeakerNotesSchema = z.strictObject({ text: z.string() });

export const AssetReferenceSchema = z.strictObject({
  id: uuid,
  kind: z.literal('image'),
  hash: z.string().regex(/^[a-f0-9]{64}$/i, 'Expected a SHA-256 hash'),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  width: positiveNumber.optional(),
  height: positiveNumber.optional(),
  localPath: z.string().min(1),
  createdAt: timestamp
});

const baseElementShape = {
  id: uuid,
  x: finiteNumber,
  y: finiteNumber,
  width: nonNegativeNumber,
  height: nonNegativeNumber,
  rotation: finiteNumber,
  opacity: finiteNumber.min(0).max(1),
  zIndex: z.number().int(),
  locked: z.boolean(),
  hidden: z.boolean(),
  groupId: uuid.optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
};

export const TextStyleRangeSchema = z
  .strictObject({
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
    fontFamily: z.string().min(1).optional(),
    fontSize: positiveNumber.optional(),
    fontWeight: positiveNumber.optional(),
    fontStyle: z.enum(['normal', 'italic']).optional(),
    color: color.optional()
  })
  .refine((range) => range.end > range.start, {
    message: 'Text style range end must be greater than start'
  });

export const TextElementSchema = z.strictObject({
  ...baseElementShape,
  type: z.literal('text'),
  text: z.string(),
  fontFamily: z.string().min(1),
  fontSize: positiveNumber,
  fontWeight: positiveNumber,
  fontStyle: z.enum(['normal', 'italic']),
  color,
  horizontalAlign: z.enum(['left', 'center', 'right', 'justify']),
  verticalAlign: z.enum(['top', 'middle', 'bottom']),
  lineHeight: positiveNumber,
  letterSpacing: finiteNumber,
  autoFit: z.enum(['none', 'shrink', 'resize-height']),
  padding: z.strictObject({
    top: nonNegativeNumber,
    right: nonNegativeNumber,
    bottom: nonNegativeNumber,
    left: nonNegativeNumber
  }),
  textStyles: z.array(TextStyleRangeSchema).optional()
});

export const ImageElementSchema = z.strictObject({
  ...baseElementShape,
  type: z.literal('image'),
  assetId: uuid,
  fit: z.enum(['contain', 'cover', 'fill']),
  crop: z
    .strictObject({
      x: finiteNumber,
      y: finiteNumber,
      width: nonNegativeNumber,
      height: nonNegativeNumber
    })
    .optional(),
  borderRadius: nonNegativeNumber.optional()
});

export const ShapeElementSchema = z.strictObject({
  ...baseElementShape,
  type: z.literal('shape'),
  shapeType: z.enum(['rectangle', 'rounded-rectangle', 'ellipse', 'triangle']),
  fill: color,
  stroke: color,
  strokeWidth: nonNegativeNumber,
  cornerRadius: nonNegativeNumber.optional()
});

export const LineElementSchema = z.strictObject({
  ...baseElementShape,
  type: z.literal('line'),
  x2: finiteNumber,
  y2: finiteNumber,
  stroke: color,
  strokeWidth: nonNegativeNumber,
  dash: z.array(nonNegativeNumber).optional(),
  startArrow: z.enum(['none', 'triangle']).optional(),
  endArrow: z.enum(['none', 'triangle']).optional()
});

export const GroupElementSchema = z.strictObject({
  ...baseElementShape,
  type: z.literal('group'),
  childIds: z.array(uuid)
});

export const SlideElementSchema = z.discriminatedUnion('type', [
  TextElementSchema,
  ImageElementSchema,
  ShapeElementSchema,
  LineElementSchema,
  GroupElementSchema
]);

export const SlideSchema = z.strictObject({
  id: uuid,
  name: z.string().min(1).optional(),
  background: SlideBackgroundSchema,
  elements: z.array(SlideElementSchema),
  notes: SpeakerNotesSchema.optional(),
  metadata: SlideMetadataSchema
});

export const SlideDocumentSchema = z.strictObject({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  id: uuid,
  title: z.string().min(1),
  description: z.string().optional(),
  size: SlideSizeSchema,
  theme: SlideThemeSchema,
  slides: z.array(SlideSchema),
  assets: z.array(AssetReferenceSchema),
  metadata: DocumentMetadataSchema
});
