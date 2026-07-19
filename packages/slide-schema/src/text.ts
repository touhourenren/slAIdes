export function splitTextGraphemes(value: string): string[] {
  const Segmenter = (
    Intl as unknown as {
      Segmenter?: new (
        locale?: string,
        options?: { granularity: 'grapheme' }
      ) => { segment(input: string): Iterable<{ segment: string }> };
    }
  ).Segmenter;
  return Segmenter
    ? [
        ...new Segmenter(undefined, { granularity: 'grapheme' }).segment(value)
      ].map((entry) => entry.segment)
    : Array.from(value);
}
