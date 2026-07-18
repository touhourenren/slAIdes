import type { SlideDocument, SlideTheme } from './types';

export const CURRENT_SCHEMA_VERSION = 1 as const;

export const DEFAULT_SLIDE_SIZE = {
  width: 13_333,
  height: 7_500,
  unit: 'slaides-unit'
} as const;

export const DEFAULT_SLIDE_THEME: SlideTheme = {
  colors: {
    background: '#FFFFFF',
    foreground: '#111827',
    primary: '#4F46E5',
    secondary: '#64748B',
    accent: '#06B6D4'
  },
  fonts: {
    heading: 'Inter',
    body: 'Inter',
    monospace: 'ui-monospace'
  }
};

const SAMPLE_DOCUMENT_ID = '018f47a2-5b6c-7d8e-9f01-23456789abcd';
const SAMPLE_SLIDE_ID = '018f47a2-5b6c-7d8e-9f01-23456789abce';
const SAMPLE_TEXT_ID = '018f47a2-5b6c-7d8e-9f01-23456789abcf';
const SAMPLE_TIMESTAMP = '2026-01-01T00:00:00.000Z';

export function createSampleDocument(): SlideDocument {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: SAMPLE_DOCUMENT_ID,
    title: 'Untitled presentation',
    size: { ...DEFAULT_SLIDE_SIZE },
    theme: structuredClone(DEFAULT_SLIDE_THEME),
    slides: [
      {
        id: SAMPLE_SLIDE_ID,
        name: 'Title slide',
        background: { color: DEFAULT_SLIDE_THEME.colors.background },
        elements: [
          {
            id: SAMPLE_TEXT_ID,
            type: 'text',
            x: 1_000,
            y: 1_000,
            width: 11_333,
            height: 1_200,
            rotation: 0,
            opacity: 1,
            zIndex: 0,
            locked: false,
            hidden: false,
            text: 'SlAIdes',
            fontFamily: 'Inter',
            fontSize: 480,
            fontWeight: 700,
            fontStyle: 'normal',
            color: '#111827',
            horizontalAlign: 'center',
            verticalAlign: 'middle',
            lineHeight: 1.2,
            letterSpacing: 0,
            autoFit: 'shrink',
            padding: { top: 0, right: 0, bottom: 0, left: 0 }
          }
        ],
        notes: { text: '' },
        metadata: { createdAt: SAMPLE_TIMESTAMP, updatedAt: SAMPLE_TIMESTAMP }
      }
    ],
    assets: [],
    metadata: { createdAt: SAMPLE_TIMESTAMP, updatedAt: SAMPLE_TIMESTAMP }
  };
}
