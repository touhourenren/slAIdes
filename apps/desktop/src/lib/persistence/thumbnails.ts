import type { AssetReference, SlideDocument } from '@slaides/slide-schema';
import type { BinaryEntry } from './project-repository';

export interface ThumbnailRenderOptions {
  width?: number;
  height?: number;
  assetUrls?: Map<string, string>;
}

export interface ThumbnailRenderResult {
  entries: BinaryEntry[];
  warnings: string[];
}

const xml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('"', '&quot;');

function slideSvg(
  document: SlideDocument,
  slideIndex: number,
  imageSources: Map<string, string>
): string {
  const slide = document.slides[slideIndex];
  const body = [...slide.elements]
    .sort((left, right) => left.zIndex - right.zIndex)
    .filter((element) => !element.hidden)
    .map((element) => {
      const transform = `rotate(${element.rotation} ${element.x + element.width / 2} ${element.y + element.height / 2})`;
      const opacity = element.opacity;
      if (element.type === 'text')
        return `<text x="${element.x}" y="${element.y + element.fontSize}" font-family="${xml(element.fontFamily)}" font-size="${element.fontSize}" font-weight="${element.fontWeight}" font-style="${element.fontStyle}" fill="${xml(element.color)}" opacity="${opacity}" transform="${transform}">${xml(element.text)}</text>`;
      if (element.type === 'line')
        return `<line x1="${element.x}" y1="${element.y}" x2="${element.x2}" y2="${element.y2}" stroke="${xml(element.stroke)}" stroke-width="${element.strokeWidth}" opacity="${opacity}" />`;
      if (element.type === 'image') {
        const source = imageSources.get(element.assetId);
        if (source)
          return `<image href="${xml(source)}" x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" preserveAspectRatio="${element.fit === 'contain' ? 'xMidYMid meet' : element.fit === 'cover' ? 'xMidYMid slice' : 'none'}" opacity="${opacity}" transform="${transform}" />`;
        return `<rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" fill="#dfe3eb" opacity="${opacity}" transform="${transform}" />`;
      }
      if (element.type !== 'shape') return '';
      if (element.shapeType === 'ellipse')
        return `<ellipse cx="${element.x + element.width / 2}" cy="${element.y + element.height / 2}" rx="${element.width / 2}" ry="${element.height / 2}" fill="${xml(element.fill)}" stroke="${xml(element.stroke)}" stroke-width="${element.strokeWidth}" opacity="${opacity}" transform="${transform}" />`;
      if (element.shapeType === 'triangle')
        return `<polygon points="${element.x + element.width / 2},${element.y} ${element.x + element.width},${element.y + element.height} ${element.x},${element.y + element.height}" fill="${xml(element.fill)}" stroke="${xml(element.stroke)}" stroke-width="${element.strokeWidth}" opacity="${opacity}" transform="${transform}" />`;
      return `<rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" rx="${element.cornerRadius ?? 0}" fill="${xml(element.fill)}" stroke="${xml(element.stroke)}" stroke-width="${element.strokeWidth}" opacity="${opacity}" transform="${transform}" />`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${document.size.width}" height="${document.size.height}" viewBox="0 0 ${document.size.width} ${document.size.height}"><rect width="100%" height="100%" fill="${xml(slide.background.color)}"/>${body}</svg>`;
}

async function dataUrl(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(reader.error ?? new Error('Asset read failed'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

async function rasterize(
  svg: string,
  width: number,
  height: number
): Promise<number[]> {
  const source = URL.createObjectURL(
    new Blob([svg], { type: 'image/svg+xml' })
  );
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = source;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('2D canvas is unavailable');
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value ? resolve(value) : reject(new Error('PNG encoding failed')),
        'image/png'
      )
    );
    return [...new Uint8Array(await blob.arrayBuffer())];
  } finally {
    URL.revokeObjectURL(source);
  }
}

export async function renderSlideThumbnails(
  document: SlideDocument,
  _assets: AssetReference[],
  options: ThumbnailRenderOptions = {}
): Promise<ThumbnailRenderResult> {
  const width = options.width ?? 320;
  const height = options.height ?? 180;
  const entries: BinaryEntry[] = [];
  const warnings: string[] = [];
  const imageSources = new Map<string, string>();
  for (const asset of _assets) {
    const url = options.assetUrls?.get(asset.hash);
    if (!url) continue;
    try {
      imageSources.set(asset.id, await dataUrl(url));
    } catch (error) {
      warnings.push(
        `Image omitted from thumbnails: ${asset.filename} (${String(error)})`
      );
    }
  }
  for (let index = 0; index < document.slides.length; index += 1) {
    const slide = document.slides[index];
    try {
      entries.push({
        path: `thumbnails/slide-${slide.id}.png`,
        bytes: await rasterize(
          slideSvg(document, index, imageSources),
          width,
          height
        )
      });
    } catch (error) {
      warnings.push(
        `Thumbnail omitted for slide ${index + 1}: ${String(error)}`
      );
    }
  }
  return { entries, warnings };
}
