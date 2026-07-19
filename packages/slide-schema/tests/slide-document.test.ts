import { describe, expect, it } from 'vitest';
import {
  SlideDocumentSchema,
  createSampleDocument,
  deserializeSlideDocument,
  parseSlideDocument,
  serializeSlideDocument,
  splitTextGraphemes
} from '../src';
import type { BaseSlideElement, SlideElement } from '../src';

const ids = {
  image: '018f47a2-5b6c-7d8e-9f01-23456789abd0',
  asset: '018f47a2-5b6c-7d8e-9f01-23456789abd1',
  shape: '018f47a2-5b6c-7d8e-9f01-23456789abd2',
  line: '018f47a2-5b6c-7d8e-9f01-23456789abd3',
  group: '018f47a2-5b6c-7d8e-9f01-23456789abd4'
};

const baseElement: Omit<BaseSlideElement, 'id' | 'type'> = {
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  rotation: 0,
  opacity: 1,
  zIndex: 1,
  locked: false,
  hidden: false
};

function documentWithAllElementTypes() {
  const document = createSampleDocument();
  const elements: SlideElement[] = [
    ...document.slides[0].elements,
    {
      ...baseElement,
      id: ids.image,
      type: 'image',
      assetId: ids.asset,
      fit: 'contain'
    },
    {
      ...baseElement,
      id: ids.shape,
      type: 'shape',
      shapeType: 'rounded-rectangle',
      fill: '#FFFFFF',
      stroke: '#000000',
      strokeWidth: 1,
      cornerRadius: 20
    },
    {
      ...baseElement,
      id: ids.line,
      type: 'line',
      x2: 100,
      y2: 100,
      stroke: '#000000',
      strokeWidth: 2
    },
    {
      ...baseElement,
      id: ids.group,
      type: 'group',
      childIds: [ids.shape, ids.line]
    }
  ];

  document.slides[0].elements = elements;
  document.assets.push({
    id: ids.asset,
    kind: 'image',
    hash: 'a'.repeat(64),
    filename: 'sample.png',
    mimeType: 'image/png',
    width: 800,
    height: 600,
    localPath: 'assets/sample.png',
    createdAt: '2026-01-01T00:00:00.000Z'
  });
  return document;
}

describe('SlideDocumentSchema', () => {
  it('uses grapheme indexes for rich-text ranges', () => {
    expect(splitTextGraphemes('A👨‍👩‍👧‍👦か\u3099')).toEqual(['A', '👨‍👩‍👧‍👦', 'か\u3099']);
  });
  it('validates a sample document containing all element types', () => {
    const document = documentWithAllElementTypes();
    const result = SlideDocumentSchema.safeParse(document);
    expect(result.success).toBe(true);
    expect(document.slides[0]?.elements[0]).toMatchObject({
      type: 'text',
      autoFit: 'none'
    });
  });

  it.each([
    [
      'invalid document UUID',
      (input: Record<string, unknown>) => (input.id = 'not-a-uuid')
    ],
    [
      'invalid timestamp',
      (input: Record<string, unknown>) =>
        (input.metadata = { createdAt: 'today', updatedAt: 'today' })
    ],
    [
      'out-of-range opacity',
      (input: Record<string, unknown>) => {
        const slides = input.slides as Array<{
          elements: Array<Record<string, unknown>>;
        }>;
        slides[0].elements[0].opacity = 1.1;
      }
    ],
    [
      'negative width',
      (input: Record<string, unknown>) => {
        const slides = input.slides as Array<{
          elements: Array<Record<string, unknown>>;
        }>;
        slides[0].elements[0].width = -1;
      }
    ],
    [
      'non-integer zIndex',
      (input: Record<string, unknown>) => {
        const slides = input.slides as Array<{
          elements: Array<Record<string, unknown>>;
        }>;
        slides[0].elements[0].zIndex = 1.5;
      }
    ],
    [
      'unknown root field',
      (input: Record<string, unknown>) => (input.unexpected = true)
    ]
  ])('rejects %s', (_name, mutate) => {
    const input = structuredClone(createSampleDocument()) as unknown as Record<
      string,
      unknown
    >;
    mutate(input);
    expect(() => parseSlideDocument(input)).toThrow();
  });

  it('preserves document identity through JSON serialization', () => {
    const original = documentWithAllElementTypes();
    const text = original.slides[0].elements[0];
    if (text.type === 'text')
      text.textStyles = [
        {
          start: 0,
          end: 3,
          fontFamily: 'IBM Plex Sans Variable',
          fontSize: 640,
          fontStyle: 'italic',
          color: '#FF0000'
        }
      ];
    const restored = deserializeSlideDocument(serializeSlideDocument(original));
    expect(restored).toEqual(original);
  });

  it('rejects malformed JSON before schema validation', () => {
    expect(() => deserializeSlideDocument('{')).toThrow(SyntaxError);
  });

  it('migrates schema v1 text elements to rich-text capable schema v2', () => {
    const legacy = structuredClone(createSampleDocument()) as unknown as Record<
      string,
      unknown
    >;
    legacy.schemaVersion = 1;
    const slides = legacy.slides as Array<{
      elements: Array<Record<string, unknown>>;
    }>;
    delete slides[0].elements[0].textStyles;
    const migrated = parseSlideDocument(legacy);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.slides[0].elements[0]).toMatchObject({
      type: 'text',
      textStyles: []
    });
  });
});
