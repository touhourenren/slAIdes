import { afterEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { createHistoryState } from '@slaides/editor-core';
import { createSampleDocument } from '@slaides/slide-schema';
import {
  canonicalize,
  closePromptStore,
  isTabDirty,
  performCloseTab,
  requestCloseTab,
  resolveClosePrompt,
  workspaceStore,
  workspaceTabTitle
} from './workspace';
import type { WorkspaceTab } from './workspace';

function tab(revision: number, saved: number | null): WorkspaceTab {
  const document = createSampleDocument();
  return {
    id: crypto.randomUUID(),
    document,
    history: createHistoryState(100),
    editorView: {
      activeSlideId: document.slides[0].id,
      selectedElementIds: [],
      zoom: 1,
      viewport: { x: 0, y: 0 },
      activeTool: 'select',
      inspectorTab: 'design'
    },
    filePath: null,
    recoveryPath: '',
    saveState: 'dirty',
    documentRevision: revision,
    lastSavedRevision: saved,
    lastRecoveryRevision: null,
    lastSavedHash: null,
    assets: { entries: new Map(), objectUrls: new Map() },
    closeState: 'idle'
  };
}

describe('workspace persistence state', () => {
  afterEach(() => {
    workspaceStore.set({ tabs: [], activeTabId: '', initialized: false });
  });

  it('canonicalizes object keys recursively', () => {
    expect(canonicalize({ z: 1, nested: { b: 2, a: 1 }, a: 0 })).toBe(
      '{"a":0,"nested":{"a":1,"b":2},"z":1}'
    );
  });

  it('uses document revision rather than view state for dirty state', () => {
    const clean = tab(4, 4);
    expect(isTabDirty(clean)).toBe(false);
    clean.editorView.zoom = 3;
    clean.editorView.selectedElementIds = ['selection-only'];
    expect(isTabDirty(clean)).toBe(false);
    expect(isTabDirty({ ...clean, documentRevision: 5 })).toBe(true);
  });

  it('uses the saved filename for tab and window titles', () => {
    expect(
      workspaceTabTitle({
        document: createSampleDocument(),
        filePath: '/projects/quarterly-review.slaides'
      })
    ).toBe('quarterly-review.slaides');
  });

  it('prompts before closing a dirty tab and keeps it open on cancel', async () => {
    const dirty = tab(2, null);
    workspaceStore.set({
      tabs: [dirty],
      activeTabId: dirty.id,
      initialized: true
    });
    const closing = requestCloseTab(dirty.id);
    expect(get(closePromptStore)?.tabId).toBe(dirty.id);
    resolveClosePrompt('cancel');
    await expect(closing).resolves.toEqual({ type: 'cancelled' });
    expect(get(workspaceStore).tabs).toHaveLength(1);
  });

  it('leaves an empty workspace after the final tab closes', () => {
    const clean = tab(3, 3);
    workspaceStore.set({
      tabs: [clean],
      activeTabId: clean.id,
      initialized: true
    });
    performCloseTab(clean.id);
    expect(get(workspaceStore)).toMatchObject({ tabs: [], activeTabId: '' });
  });
});
