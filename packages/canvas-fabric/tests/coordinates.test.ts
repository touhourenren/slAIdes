import { describe, expect, it } from 'vitest';
import { Line, Rect } from 'fabric';
import {
  applyLineGeometry,
  calculateImageLayout,
  calculateTextResize,
  canvasToDomain,
  domainScale,
  domainToCanvas,
  normalizeLineTransform,
  normalizeObjectTransform,
  unrotatedFramePosition,
  zoomOffsetAtPoint,
  zoomRenderSize
} from '../src';

const textSnapshot = {
  x: 100,
  y: 200,
  width: 400,
  height: 200,
  rotation: 0,
  fontSize: 40,
  lineHeight: 1.2,
  padding: { top: 10, right: 10, bottom: 10, left: 10 },
  minimumFontSize: 8
};

describe('coordinate conversion', () => {
  it('round trips logical units', () => {
    const scale = domainScale({
      width: 13333,
      height: 7500,
      unit: 'slaides-unit'
    });
    expect(canvasToDomain(domainToCanvas(4321, scale), scale)).toBe(4321);
  });
  it('uses a 1200 pixel render width', () => {
    expect(
      domainToCanvas(
        13333,
        domainScale({ width: 13333, height: 7500, unit: 'slaides-unit' })
      )
    ).toBe(1200);
  });
});

describe('viewport zoom', () => {
  it('keeps the content under the pointer stationary', () => {
    const pointer = { x: 180, y: -90 };
    const nextOffset = zoomOffsetAtPoint(1, 2, { x: 0, y: 0 }, pointer);
    expect(nextOffset).toEqual({ x: -180, y: 90 });
    expect(nextOffset.x + pointer.x * 2).toBe(pointer.x);
    expect(nextOffset.y + pointer.y * 2).toBe(pointer.y);
  });
  it('increases the backing render area instead of stretching pixels', () => {
    const size = zoomRenderSize(
      { width: 13333, height: 7500, unit: 'slaides-unit' },
      2
    );
    expect(size.width).toBe(2400);
    expect(size.height).toBeCloseTo(1350.03, 2);
  });
});

describe('image fitting', () => {
  it('contains a wide image without cropping or distortion', () => {
    expect(calculateImageLayout(800, 200, 400, 300, 'contain')).toEqual({
      cropX: 0,
      cropY: 0,
      sourceWidth: 800,
      sourceHeight: 200,
      scaleX: 0.5,
      scaleY: 0.5
    });
  });

  it('center-crops a wide image for cover', () => {
    expect(calculateImageLayout(800, 200, 400, 300, 'cover')).toEqual({
      cropX: 266.6666666666667,
      cropY: 0,
      sourceWidth: 266.66666666666663,
      sourceHeight: 200,
      scaleX: 1.5000000000000002,
      scaleY: 1.5
    });
  });

  it('stretches independently for fill', () => {
    expect(calculateImageLayout(800, 200, 400, 300, 'fill')).toEqual({
      cropX: 0,
      cropY: 0,
      sourceWidth: 800,
      sourceHeight: 200,
      scaleX: 0.5,
      scaleY: 1.5
    });
  });
});

describe('text frame resizing', () => {
  it('changes only width from a side handle', () => {
    const resized = calculateTextResize(textSnapshot, { x: 650, y: 300 }, 'mr');

    expect(resized).toMatchObject({
      x: 100,
      y: 200,
      width: 550,
      height: 200,
      fontSize: 40
    });
  });

  it('changes only height from a vertical handle', () => {
    const resized = calculateTextResize(textSnapshot, { x: 300, y: 500 }, 'mb');

    expect(resized).toMatchObject({
      x: 100,
      y: 200,
      width: 400,
      height: 300,
      fontSize: 40
    });
  });

  it('scales the frame, font, and padding equally from a corner', () => {
    const resized = calculateTextResize(textSnapshot, { x: 900, y: 600 }, 'br');

    expect(resized).toMatchObject({
      x: 100,
      y: 200,
      width: 800,
      height: 400,
      fontSize: 80,
      padding: { top: 20, right: 20, bottom: 20, left: 20 }
    });
  });

  it('enforces one-character side minima and the corner font floor', () => {
    const side = calculateTextResize(textSnapshot, { x: 101, y: 300 }, 'mr');
    const corner = calculateTextResize(textSnapshot, { x: 100, y: 200 }, 'br');

    expect(side.width).toBe(60);
    expect(corner.fontSize).toBe(8);
    expect(corner.width).toBe(80);
    expect(corner.height).toBe(40);
  });

  it('keeps the opposite anchor fixed on a rotated frame', () => {
    const rotated = { ...textSnapshot, rotation: 45 };
    const radians = Math.PI / 4;
    const ux = { x: Math.cos(radians), y: Math.sin(radians) };
    const startCenter = {
      x: rotated.x + rotated.width / 2,
      y: rotated.y + rotated.height / 2
    };
    const fixed = {
      x: startCenter.x - ux.x * (rotated.width / 2),
      y: startCenter.y - ux.y * (rotated.width / 2)
    };
    const resized = calculateTextResize(
      rotated,
      { x: fixed.x + ux.x * 600, y: fixed.y + ux.y * 600 },
      'mr'
    );
    const nextCenter = {
      x: resized.x + resized.width / 2,
      y: resized.y + resized.height / 2
    };

    expect(nextCenter.x - ux.x * (resized.width / 2)).toBeCloseTo(fixed.x);
    expect(nextCenter.y - ux.y * (resized.width / 2)).toBeCloseTo(fixed.y);
  });

  it.each([0, 45, 90])(
    'keeps the opposite corner fixed at %s degrees',
    (rotation) => {
      const snapshot = { ...textSnapshot, rotation };
      const radians = (rotation * Math.PI) / 180;
      const ux = { x: Math.cos(radians), y: Math.sin(radians) };
      const uy = { x: -Math.sin(radians), y: Math.cos(radians) };
      const center = {
        x: snapshot.x + snapshot.width / 2,
        y: snapshot.y + snapshot.height / 2
      };
      const fixed = {
        x:
          center.x - ux.x * (snapshot.width / 2) - uy.x * (snapshot.height / 2),
        y: center.y - ux.y * (snapshot.width / 2) - uy.y * (snapshot.height / 2)
      };
      const scale = 0.6;
      const resized = calculateTextResize(
        snapshot,
        {
          x:
            fixed.x +
            ux.x * snapshot.width * scale +
            uy.x * snapshot.height * scale,
          y:
            fixed.y +
            ux.y * snapshot.width * scale +
            uy.y * snapshot.height * scale
        },
        'br'
      );
      const nextCenter = {
        x: resized.x + resized.width / 2,
        y: resized.y + resized.height / 2
      };
      const nextFixed = {
        x:
          nextCenter.x -
          ux.x * (resized.width / 2) -
          uy.x * (resized.height / 2),
        y:
          nextCenter.y -
          ux.y * (resized.width / 2) -
          uy.y * (resized.height / 2)
      };

      expect(nextFixed.x).toBeCloseTo(fixed.x);
      expect(nextFixed.y).toBeCloseTo(fixed.y);
      expect(resized.width / snapshot.width).toBeCloseTo(scale);
      expect(resized.height / snapshot.height).toBeCloseTo(scale);
    }
  );
});

describe('transform normalization', () => {
  it('keeps a line at its document position after its endpoints change', () => {
    const line = new Line([0, 0, 200, 0], {
      left: 100,
      top: 80,
      strokeWidth: 6,
      originX: 'left',
      originY: 'top'
    });

    applyLineGeometry(line, { x: 320, y: 240, x2: 760, y2: 390 });

    expect(line.left).toBe(320);
    expect(line.top).toBe(240);
    expect(line.x2 - line.x1).toBe(440);
    expect(line.y2 - line.y1).toBe(150);
  });

  it('keeps the fixed corner visually stable with a uniform stroke', () => {
    const object = new Rect({
      left: 250,
      top: 150,
      width: 300,
      height: 160,
      strokeWidth: 12,
      strokeUniform: true,
      originX: 'center',
      originY: 'center',
      angle: 37,
      scaleX: 1.5,
      scaleY: 1.4
    });
    const anchor = object.getPointByOrigin('left', 'top');

    normalizeObjectTransform(object, undefined, 'br');

    const normalizedAnchor = object.getPointByOrigin('left', 'top');
    expect(normalizedAnchor.x).toBeCloseTo(anchor.x);
    expect(normalizedAnchor.y).toBeCloseTo(anchor.y);
  });

  it('keeps domain coordinates stable when a centered object rotates', () => {
    const object = new Rect({
      left: 250,
      top: 150,
      width: 300,
      height: 160,
      strokeWidth: 0,
      originX: 'center',
      originY: 'center'
    });

    expect(unrotatedFramePosition(object, 300, 160)).toEqual({
      x: 100,
      y: 70
    });

    object.rotate(137);
    object.setCoords();

    expect(unrotatedFramePosition(object, 300, 160)).toEqual({
      x: 100,
      y: 70
    });
  });

  it('keeps the top-left anchor for a bottom-right resize', () => {
    const object = new Rect({
      left: 100,
      top: 80,
      width: 200,
      height: 100,
      strokeWidth: 0,
      originX: 'left',
      originY: 'top',
      scaleX: 1.5,
      scaleY: 2
    });

    expect(normalizeObjectTransform(object, undefined, 'br')).toEqual({
      width: 300,
      height: 200
    });
    expect({ left: object.left, top: object.top }).toEqual({
      left: 100,
      top: 80
    });
  });

  it('normalizes line scaling into persistent endpoints', () => {
    const line = new Line([0, 0, 200, 0], {
      left: 100,
      top: 80,
      strokeWidth: 6,
      scaleX: 1.5,
      scaleY: 1
    });

    const normalized = normalizeLineTransform(line);

    expect(normalized.x2 - normalized.x).toBeCloseTo(300);
    expect(normalized.y2 - normalized.y).toBeCloseTo(0);
    expect(normalized.strokeWidth).toBe(6);
    expect(line.scaleX).toBe(1);
  });

  it('keeps the opposite corner for a top-left resize', () => {
    const object = new Rect({
      left: 150,
      top: 120,
      width: 200,
      height: 100,
      strokeWidth: 0,
      originX: 'left',
      originY: 'top',
      scaleX: 1.25,
      scaleY: 1.8
    });
    const right = object.left + object.width * object.scaleX;
    const bottom = object.top + object.height * object.scaleY;

    normalizeObjectTransform(object, undefined, 'tl');

    expect(object.left + object.width).toBeCloseTo(right);
    expect(object.top + object.height).toBeCloseTo(bottom);
  });

  it('keeps the opposite anchor when content layout changes dimensions', () => {
    const object = new Rect({
      left: 120,
      top: 90,
      width: 200,
      height: 100,
      strokeWidth: 0,
      scaleX: 1.5,
      scaleY: 1.5
    });
    const anchor = object.getPointByOrigin('right', 'bottom');

    normalizeObjectTransform(
      object,
      (width, height) => object.set({ width: width + 4, height: height + 4 }),
      'tl'
    );

    expect(object.getPointByOrigin('right', 'bottom').x).toBeCloseTo(anchor.x);
    expect(object.getPointByOrigin('right', 'bottom').y).toBeCloseTo(anchor.y);
  });
});
