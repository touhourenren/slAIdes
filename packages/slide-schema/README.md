# @slaides/slide-schema

Canonical TypeScript types, Zod schemas, defaults, and JSON serialization for SlAIdes documents.
This package is infrastructure-independent and must not import Tauri, rendering, database, export,
or AI libraries.

```ts
import {
  createSampleDocument,
  serializeSlideDocument
} from '@slaides/slide-schema';

const json = serializeSlideDocument(createSampleDocument());
```

All external JSON must pass through `parseSlideDocument` or `deserializeSlideDocument` before use.
Schema v2 adds optional grapheme-based `textStyles` ranges for mixed font family, size, weight,
style, and color inside one text element. Schema v1 documents are migrated to v2 during parsing.
Binary image data and renderer-specific objects remain outside the document.
