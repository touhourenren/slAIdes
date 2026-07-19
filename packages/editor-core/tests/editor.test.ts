import { describe, expect, it } from 'vitest';
import { createSampleDocument } from '@slaides/slide-schema';
import {
  addElement,
  addSlide,
  clampCornerRadius,
  createElement,
  createSlide,
  moveElementLayer,
  removeElement,
  removeSlide,
  reorderSlide,
  updateElement,
  updateSlideNotes
} from '../src';

describe('editor-core', () => {
  it('creates all Phase 3 element types', () => {
    expect(
      ['text', 'image', 'shape', 'line'].map(
        (type) => createElement(type as 'text').type
      )
    ).toEqual(['text', 'image', 'shape', 'line']);
  });
  it('creates a restrained presentation-ready default shape', () => {
    const shape = createElement('shape');
    expect(shape).toMatchObject({
      type: 'shape',
      x: 5066,
      y: 2850,
      width: 3200,
      height: 1800,
      fill: '#DCE7F7',
      stroke: '#6E85A8',
      strokeWidth: 8
    });
  });
  it('uses the platform system font for new text', () => {
    expect(createElement('text')).toMatchObject({
      type: 'text',
      fontFamily: 'system-ui',
      autoFit: 'none'
    });
  });
  it('adds, reorders, and removes slides immutably', () => {
    const original = createSampleDocument();
    const added = addSlide(
      original,
      createSlide({
        id: '018f47a2-5b6c-7d8e-9f01-23456789abe0',
        now: '2026-01-01T00:00:00.000Z'
      })
    );
    expect(original.slides).toHaveLength(1);
    expect(reorderSlide(original, 0, 0)).toBe(original);
    expect(added.slides).toHaveLength(2);
    const reordered = reorderSlide(added, 1, 0);
    expect(reordered.slides[0].id).toBe('018f47a2-5b6c-7d8e-9f01-23456789abe0');
    expect(removeSlide(reordered, reordered.slides[0].id).slides).toHaveLength(
      1
    );
    expect(removeSlide(original, original.slides[0].id)).toBe(original);
  });
  it('edits elements and normalizes layers', () => {
    const original = createSampleDocument();
    const slideId = original.slides[0].id;
    const shape = createElement('shape', {
      id: '018f47a2-5b6c-7d8e-9f01-23456789abe1'
    });
    const added = addElement(original, slideId, shape);
    expect(added.slides[0].elements.map((e) => e.zIndex)).toEqual([0, 1]);
    const updated = updateElement(added, slideId, shape.id, { opacity: 0.4 });
    expect(updated.slides[0].elements[1].opacity).toBe(0.4);
    const moved = moveElementLayer(
      updated,
      slideId,
      original.slides[0].elements[0].id,
      'front'
    );
    expect(moved.slides[0].elements.at(-1)?.id).toBe(
      original.slides[0].elements[0].id
    );
    expect(
      removeElement(moved, slideId, shape.id).slides[0].elements.map(
        (e) => e.zIndex
      )
    ).toEqual([0]);
  });
  it('updates speaker notes immutably', () => {
    const original = createSampleDocument();
    const updated = updateSlideNotes(original, original.slides[0].id, 'Memo');
    expect(original.slides[0].notes?.text).toBe('');
    expect(updated.slides[0].notes?.text).toBe('Memo');
  });
  it('clamps rounded corners to valid shape geometry', () => {
    expect(clampCornerRadius(4000, 2000, 420)).toBe(420);
    expect(clampCornerRadius(4000, 2000, 5000)).toBe(1000);
    expect(clampCornerRadius(4000, 2000, -20)).toBe(0);
  });
});
