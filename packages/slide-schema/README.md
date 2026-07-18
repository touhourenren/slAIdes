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
