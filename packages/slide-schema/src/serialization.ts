import { SlideDocumentSchema } from './schemas';
import type { SlideDocument } from './types';

export function parseSlideDocument(input: unknown): SlideDocument {
  return SlideDocumentSchema.parse(input);
}

export function serializeSlideDocument(document: SlideDocument): string {
  return JSON.stringify(parseSlideDocument(document), null, 2);
}

export function deserializeSlideDocument(json: string): SlideDocument {
  return parseSlideDocument(JSON.parse(json) as unknown);
}
