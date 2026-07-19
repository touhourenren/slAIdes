import { SlideDocumentSchema } from './schemas';
import type { SlideDocument } from './types';

function migrateSlideDocument(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input;
  const value = input as Record<string, unknown>;
  if (value.schemaVersion !== 1) return input;
  const migrated = structuredClone(value);
  const slides = Array.isArray(migrated.slides) ? migrated.slides : [];
  for (const slide of slides) {
    if (!slide || typeof slide !== 'object') continue;
    const elements = Array.isArray((slide as Record<string, unknown>).elements)
      ? ((slide as Record<string, unknown>).elements as unknown[])
      : [];
    for (const element of elements) {
      if (
        element &&
        typeof element === 'object' &&
        (element as Record<string, unknown>).type === 'text'
      )
        (element as Record<string, unknown>).textStyles = [];
    }
  }
  migrated.schemaVersion = 2;
  return migrated;
}

export function parseSlideDocument(input: unknown): SlideDocument {
  return SlideDocumentSchema.parse(migrateSlideDocument(input));
}

export function serializeSlideDocument(document: SlideDocument): string {
  return JSON.stringify(parseSlideDocument(document), null, 2);
}

export function deserializeSlideDocument(json: string): SlideDocument {
  return parseSlideDocument(JSON.parse(json) as unknown);
}
