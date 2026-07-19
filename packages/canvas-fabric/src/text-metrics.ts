export type TextWidthMeasurer = (text: string) => number;

const MAX_TEXT_RUN_CACHE_ENTRIES = 256;
const MAX_PREFIX_CACHE_ENTRIES = 8192;
const textRunCache = new Map<string, readonly number[]>();
const prefixWidthCache = new Map<string, number>();
let measuringContext: CanvasRenderingContext2D | undefined;

function setBoundedCache<Value>(
  cache: Map<string, Value>,
  key: string,
  value: Value,
  limit: number
): void {
  if (cache.size >= limit) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
  cache.set(key, value);
}

/**
 * Measures every logical caret boundary from the complete prefix that the
 * browser shapes. Measuring prefixes avoids accumulating Fabric's scaled
 * pair-kerning approximation across a long run of text.
 */
export function measurePrefixAdvances(
  graphemes: readonly string[],
  measureWidth: TextWidthMeasurer
): number[] {
  const advances = [0];
  let prefix = '';
  for (const grapheme of graphemes) {
    prefix += grapheme;
    advances.push(measureWidth(prefix));
  }
  return advances;
}

export function measureCanvasTextAdvances(
  graphemes: readonly string[],
  fontDeclaration: string,
  direction: CanvasDirection = 'ltr'
): readonly number[] | undefined {
  if (typeof document === 'undefined') return undefined;
  measuringContext ??=
    document.createElement('canvas').getContext('2d') ?? undefined;
  if (!measuringContext) return undefined;

  const text = graphemes.join('');
  const key = `${direction}\u0000${fontDeclaration}\u0000${text}`;
  const cached = textRunCache.get(key);
  if (cached) return cached;

  measuringContext.font = fontDeclaration;
  measuringContext.direction = direction;
  const prefixKey = `${direction}\u0000${fontDeclaration}\u0000`;
  const advances = measurePrefixAdvances(graphemes, (prefix) => {
    const widthKey = prefixKey + prefix;
    const knownWidth = prefixWidthCache.get(widthKey);
    if (knownWidth !== undefined) return knownWidth;
    const width = measuringContext!.measureText(prefix).width;
    setBoundedCache(
      prefixWidthCache,
      widthKey,
      width,
      MAX_PREFIX_CACHE_ENTRIES
    );
    return width;
  });
  setBoundedCache(textRunCache, key, advances, MAX_TEXT_RUN_CACHE_ENTRIES);
  return advances;
}

export function clearCanvasTextMetrics(): void {
  textRunCache.clear();
  prefixWidthCache.clear();
}
