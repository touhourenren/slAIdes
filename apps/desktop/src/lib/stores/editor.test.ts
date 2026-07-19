import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import {
  addNewSlide,
  applyTextFormatting,
  canRedoStore,
  canUndoStore,
  closeHistoryGroup,
  copySelected,
  cutSelected,
  documentStore,
  deleteActiveSlide,
  disposeAssets,
  duplicateSelected,
  editorSessionStore,
  historyStore,
  insertElement,
  insertImage,
  pasteClipboardObjects,
  patchElement,
  patchSlideNotes,
  redo,
  resetEditorSession,
  setTextSelection,
  undo
} from './editor';

describe('editor history session', () => {
  beforeEach(() => resetEditorSession());
  afterEach(() => disposeAssets());

  it('restores the document and selection through undo and redo', () => {
    const originalCount = get(documentStore).slides[0].elements.length;
    insertElement('shape');
    const inserted = get(editorSessionStore).selectedElementIds[0];
    expect(get(documentStore).slides[0].elements).toHaveLength(
      originalCount + 1
    );
    expect(get(canUndoStore)).toBe(true);

    undo();
    expect(get(documentStore).slides[0].elements).toHaveLength(originalCount);
    expect(get(editorSessionStore).selectedElementIds).toEqual([]);
    expect(get(canRedoStore)).toBe(true);

    redo();
    expect(get(documentStore).slides[0].elements).toHaveLength(
      originalCount + 1
    );
    expect(get(editorSessionStore).selectedElementIds).toEqual([inserted]);
  });

  it('coalesces note typing until the group is closed', () => {
    patchSlideNotes('H');
    patchSlideNotes('Hello');
    expect(get(historyStore).past).toHaveLength(1);
    closeHistoryGroup();
    patchSlideNotes('Hello again');
    expect(get(historyStore).past).toHaveLength(2);
    undo();
    expect(get(documentStore).slides[0].notes?.text).toBe('Hello');
  });

  it('duplicates selected objects and invalidates redo on a new branch', () => {
    insertElement('shape');
    const sourceId = get(editorSessionStore).selectedElementIds[0];
    const source = get(documentStore).slides[0].elements.find(
      (element) => element.id === sourceId
    );
    duplicateSelected();
    const copyId = get(editorSessionStore).selectedElementIds[0];
    const copy = get(documentStore).slides[0].elements.find(
      (element) => element.id === copyId
    );
    expect(copy).toMatchObject({ x: source!.x + 160, y: source!.y + 160 });

    undo();
    expect(get(editorSessionStore).selectedElementIds).toEqual([sourceId]);
    expect(get(canRedoStore)).toBe(true);
    insertElement('text');
    expect(get(canRedoStore)).toBe(false);
  });

  it('restores the active slide when a slide deletion is undone', () => {
    addNewSlide();
    const addedSlideId = get(editorSessionStore).activeSlideId;
    deleteActiveSlide();
    expect(get(editorSessionStore).activeSlideId).not.toBe(addedSlideId);
    undo();
    expect(get(editorSessionStore).activeSlideId).toBe(addedSlideId);
    expect(
      get(documentStore).slides.some((slide) => slide.id === addedSlideId)
    ).toBe(true);
  });

  it('groups continuous property edits by element and field', () => {
    insertElement('shape');
    const elementId = get(editorSessionStore).selectedElementIds[0];
    patchElement(
      elementId,
      { x: 5100 },
      {
        label: 'Edit shape',
        mergeKey: `property:${elementId}:x`
      }
    );
    patchElement(
      elementId,
      { x: 5200 },
      {
        label: 'Edit shape',
        mergeKey: `property:${elementId}:x`
      }
    );
    expect(get(historyStore).past).toHaveLength(2);
    undo();
    expect(
      get(documentStore).slides[0].elements.find(
        (element) => element.id === elementId
      )?.x
    ).toBe(5066);
  });

  it('records an image asset and element as one undoable transaction', async () => {
    const originalElementCount = get(documentStore).slides[0].elements.length;
    await insertImage(
      new File([new Uint8Array([1, 2, 3])], 'sample.png', {
        type: 'image/png'
      })
    );
    expect(get(historyStore).past).toHaveLength(1);
    expect(get(documentStore).assets).toHaveLength(1);
    expect(get(documentStore).slides[0].elements).toHaveLength(
      originalElementCount + 1
    );
    undo();
    expect(get(documentStore).assets).toHaveLength(0);
    expect(get(documentStore).slides[0].elements).toHaveLength(
      originalElementCount
    );
    redo();
    expect(get(documentStore).assets).toHaveLength(1);
  });

  it('copies, cuts, and pastes selected objects as undoable actions', () => {
    insertElement('shape');
    const sourceId = get(editorSessionStore).selectedElementIds[0];
    expect(copySelected()).toBe(true);
    expect(pasteClipboardObjects()).toBe(true);
    const pastedId = get(editorSessionStore).selectedElementIds[0];
    expect(pastedId).not.toBe(sourceId);
    expect(cutSelected()).toBe(true);
    expect(
      get(documentStore).slides[0].elements.some(
        (element) => element.id === pastedId
      )
    ).toBe(false);
    undo();
    expect(
      get(documentStore).slides[0].elements.some(
        (element) => element.id === pastedId
      )
    ).toBe(true);
  });

  it('applies text formatting only to the active character selection', () => {
    insertElement('text');
    const elementId = get(editorSessionStore).selectedElementIds[0];
    setTextSelection({ elementId, start: 0, end: 6 });
    applyTextFormatting(elementId, {
      fontFamily: 'Noto Sans JP Variable',
      fontSize: 480,
      fontStyle: 'italic',
      color: '#ff0000'
    });
    const element = get(documentStore).slides[0].elements.find(
      (candidate) => candidate.id === elementId
    );
    expect(element).toMatchObject({
      type: 'text',
      fontFamily: 'IBM Plex Sans Variable',
      textStyles: [
        {
          start: 0,
          end: 6,
          fontFamily: 'Noto Sans JP Variable',
          fontSize: 480,
          fontStyle: 'italic',
          color: '#ff0000'
        }
      ]
    });
  });
});
