import { get, writable } from 'svelte/store';
import { isTauri } from '@tauri-apps/api/core';
import { appDataDir, join } from '@tauri-apps/api/path';
import { open, save } from '@tauri-apps/plugin-dialog';
import Database from '@tauri-apps/plugin-sql';
import { createHistoryState } from '@slaides/editor-core';
import {
  createSampleDocument,
  deserializeSlideDocument,
  serializeSlideDocument
} from '@slaides/slide-schema';
import type { AssetReference, SlideDocument } from '@slaides/slide-schema';
import {
  captureEditorRuntime,
  canvasTextEditingStore,
  disposeAssets,
  editorSessionStore,
  restoreEditorRuntime
} from './editor';
import type { EditorRuntimeState, EditorSnapshot } from './editor';
import { projectRepository } from '../persistence/project-repository';
import type {
  BinaryEntry,
  OpenProjectResult
} from '../persistence/project-repository';
import { renderSlideThumbnails } from '../persistence/thumbnails';

export type DocumentSaveState = 'clean' | 'dirty' | 'saving' | 'error';
export type TabCloseState = 'idle' | 'confirming' | 'saving';
export type EditorTool = 'select' | 'text' | 'shape' | 'image' | 'line';

export interface EditorViewState {
  activeSlideId: string;
  selectedElementIds: string[];
  zoom: number;
  viewport: { x: number; y: number };
  activeTool: EditorTool;
  inspectorTab: 'design' | 'layers' | 'ai';
}

export interface WorkspaceTab {
  id: string;
  document: SlideDocument;
  history: EditorRuntimeState['history'];
  editorView: EditorViewState;
  filePath: string | null;
  recoveryPath: string;
  saveState: DocumentSaveState;
  documentRevision: number;
  lastSavedRevision: number | null;
  lastRecoveryRevision: number | null;
  lastSavedHash: string | null;
  assets: AssetRegistry;
  closeState: TabCloseState;
  error?: string;
}

export interface AssetRegistry {
  entries: Map<string, AssetReference>;
  objectUrls: Map<string, string>;
}

export interface WorkspaceState {
  tabs: WorkspaceTab[];
  activeTabId: string;
  initialized: boolean;
}

export interface RecentProject {
  path: string;
  title: string;
  lastOpenedAt: string;
}

export interface ClosePrompt {
  tabId: string;
  title: string;
  filePath: string | null;
}

type CloseDecision = 'save' | 'discard' | 'cancel';

export type CloseTabResult =
  | { type: 'closed' }
  | { type: 'cancelled' }
  | { type: 'save-failed'; error: string };

interface RecoveryRow {
  tab_id: string;
  original_path: string | null;
  recovery_path: string;
  document_revision: number;
}

export const workspaceStore = writable<WorkspaceState>({
  tabs: [],
  activeTabId: '',
  initialized: false
});
export const workspaceNotice = writable<string | undefined>();
export const recentProjectsStore = writable<RecentProject[]>([]);
export const closePromptStore = writable<ClosePrompt | undefined>();

export function isTabDirty(
  tab: Pick<WorkspaceTab, 'documentRevision' | 'lastSavedRevision'>
): boolean {
  return tab.documentRevision !== tab.lastSavedRevision;
}

let database: Database | undefined;
let recoveryRoot = '';
let switching = false;
const autosaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const closeRequests = new Map<string, Promise<CloseTabResult>>();
const closePromptQueue: Array<{
  prompt: ClosePrompt;
  resolve: (decision: CloseDecision) => void;
}> = [];
let activeClosePrompt:
  | {
      prompt: ClosePrompt;
      resolve: (decision: CloseDecision) => void;
    }
  | undefined;

export function workspaceTabTitle(
  tab: Pick<WorkspaceTab, 'document' | 'filePath'>
): string {
  if (!tab.filePath) return tab.document.title || 'Untitled presentation';
  return tab.filePath.split(/[\\/]/).pop() || tab.document.title;
}

function tabFromRuntime(
  id: string,
  runtime: EditorRuntimeState,
  filePath: string | null,
  recoveryPath: string
): WorkspaceTab {
  return {
    id,
    document: runtime.session.document,
    history: runtime.history,
    editorView: {
      activeSlideId: runtime.session.activeSlideId,
      selectedElementIds: runtime.session.selectedElementIds,
      zoom: runtime.zoom,
      viewport: { x: 0, y: 0 },
      activeTool: 'select',
      inspectorTab: 'design'
    },
    filePath,
    recoveryPath,
    saveState: filePath ? 'clean' : 'dirty',
    documentRevision: runtime.session.documentRevision,
    lastSavedRevision: filePath ? runtime.session.documentRevision : null,
    lastRecoveryRevision: null,
    lastSavedHash: null,
    assets: registryFromRuntime(runtime),
    closeState: 'idle'
  };
}

function registryFromRuntime(
  runtime: EditorRuntimeState,
  previous?: AssetRegistry
): AssetRegistry {
  const entries = new Map(previous?.entries ?? []);
  for (const asset of runtime.session.document.assets)
    entries.set(asset.hash, asset);
  const urlsById = new Map(runtime.assetUrls);
  const objectUrls = new Map(previous?.objectUrls ?? []);
  for (const [hash, asset] of entries) {
    const url = urlsById.get(asset.id);
    if (url) objectUrls.set(hash, url);
  }
  return { entries, objectUrls };
}

function runtimeFromTab(tab: WorkspaceTab): EditorRuntimeState {
  return {
    session: {
      document: tab.document,
      activeSlideId: tab.editorView.activeSlideId,
      selectedElementIds: tab.editorView.selectedElementIds,
      documentRevision: tab.documentRevision
    },
    history: tab.history,
    zoom: tab.editorView.zoom,
    assetUrls: tab.document.assets.flatMap((asset) => {
      const url = tab.assets.objectUrls.get(asset.hash);
      return url ? ([[asset.id, url]] as Array<[string, string]>) : [];
    })
  };
}

function captureActiveTab(): void {
  if (switching) return;
  const state = get(workspaceStore);
  const index = state.tabs.findIndex((tab) => tab.id === state.activeTabId);
  if (index < 0) return;
  const runtime = captureEditorRuntime();
  const previous = state.tabs[index];
  const revisionChanged =
    runtime.session.documentRevision !== previous.documentRevision;
  const next: WorkspaceTab = {
    ...previous,
    document: runtime.session.document,
    history: runtime.history,
    documentRevision: runtime.session.documentRevision,
    editorView: {
      ...previous.editorView,
      activeSlideId: runtime.session.activeSlideId,
      selectedElementIds: runtime.session.selectedElementIds,
      zoom: runtime.zoom
    },
    assets: registryFromRuntime(runtime, previous.assets),
    lastRecoveryRevision:
      revisionChanged &&
      runtime.session.documentRevision === previous.lastSavedRevision
        ? null
        : previous.lastRecoveryRevision,
    saveState: revisionChanged
      ? !isTabDirty({
          documentRevision: runtime.session.documentRevision,
          lastSavedRevision: previous.lastSavedRevision
        })
        ? 'clean'
        : 'dirty'
      : previous.saveState
  };
  const tabs = [...state.tabs];
  tabs[index] = next;
  workspaceStore.set({ ...state, tabs });
  if (revisionChanged) {
    if (isTabDirty(next)) scheduleRecoverySave(next.id);
    else {
      const timer = autosaveTimers.get(next.id);
      if (timer) clearTimeout(timer);
      autosaveTimers.delete(next.id);
      void removeRecovery(next.id);
    }
  }
}

editorSessionStore.subscribe(() => captureActiveTab());

let textEditing = false;
canvasTextEditingStore.subscribe((editing) => {
  const finished = textEditing && !editing;
  textEditing = editing;
  if (!finished) return;
  const state = get(workspaceStore);
  const tab = state.tabs.find((item) => item.id === state.activeTabId);
  if (tab && tab.documentRevision !== tab.lastRecoveryRevision)
    scheduleRecoverySave(tab.id);
});

export function activateTab(tabId: string): void {
  const state = get(workspaceStore);
  if (state.activeTabId === tabId) return;
  captureActiveTab();
  const refreshed = get(workspaceStore);
  const tab = refreshed.tabs.find((item) => item.id === tabId);
  if (!tab) return;
  switching = true;
  workspaceStore.set({ ...refreshed, activeTabId: tabId });
  restoreEditorRuntime(runtimeFromTab(tab));
  switching = false;
  void persistWorkspaceLayout();
}

export function newDocumentTab(): void {
  captureActiveTab();
  const document = createUntitledDocument();
  const session: EditorSnapshot = {
    document,
    activeSlideId: document.slides[0].id,
    selectedElementIds: [],
    documentRevision: 0
  };
  const id = crypto.randomUUID();
  const tab = tabFromRuntime(
    id,
    { session, history: createHistoryState(100), zoom: 1, assetUrls: [] },
    null,
    recoveryRoot ? `${recoveryRoot}/${id}.slaides` : ''
  );
  const state = get(workspaceStore);
  workspaceStore.set({ ...state, tabs: [...state.tabs, tab] });
  activateTab(id);
}

function createUntitledDocument(): SlideDocument {
  const sample = createSampleDocument();
  const now = new Date().toISOString();
  return {
    ...sample,
    id: crypto.randomUUID(),
    title: 'Untitled presentation',
    slides: sample.slides.map((slide) => ({
      ...slide,
      id: crypto.randomUUID(),
      elements: slide.elements.map((element) => ({
        ...element,
        id: crypto.randomUUID()
      })),
      metadata: { createdAt: now, updatedAt: now }
    })),
    metadata: { createdAt: now, updatedAt: now }
  };
}

export function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

async function documentHash(document: SlideDocument): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalize(document));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...digest]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

async function assetPayloads(tab: WorkspaceTab): Promise<BinaryEntry[]> {
  const entries: BinaryEntry[] = [];
  for (const asset of tab.document.assets) {
    const url = tab.assets.objectUrls.get(asset.hash);
    if (!url) throw new Error(`Missing asset data: ${asset.filename}`);
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
    entries.push({ path: asset.localPath, bytes: [...bytes] });
  }
  return entries;
}

function metadata(document: SlideDocument) {
  return {
    format: 'slaides',
    archiveVersion: 1,
    schemaVersion: document.schemaVersion,
    documentId: document.id,
    title: document.title,
    createdAt: document.metadata.createdAt,
    updatedAt: new Date().toISOString(),
    generator: { name: 'SlAIdes', version: '0.1.0' }
  };
}

async function writeTab(
  tabId: string,
  path: string,
  recovery: boolean
): Promise<void> {
  captureActiveTab();
  const tab = get(workspaceStore).tabs.find((item) => item.id === tabId);
  if (!tab) throw new Error('Tab no longer exists');
  const revision = tab.documentRevision;
  const hash = await documentHash(tab.document);
  updateTab(tabId, {
    saveState: recovery ? tab.saveState : 'saving',
    error: undefined
  });
  try {
    if (recovery) await markRecoveryWriting(tabId, path, tab, hash);
    const thumbnailResult = recovery
      ? { entries: [], warnings: [] }
      : await renderSlideThumbnails(tab.document, tab.document.assets, {
          assetUrls: tab.assets.objectUrls
        });
    const request = {
      path,
      documentJson: serializeSlideDocument(tab.document),
      metadataJson: JSON.stringify(metadata(tab.document), null, 2),
      assets: await assetPayloads(tab),
      thumbnails: thumbnailResult.entries
    };
    if (recovery) await projectRepository.writeRecovery(request);
    else await projectRepository.saveAtomic(request);
    const current = get(workspaceStore).tabs.find((item) => item.id === tabId);
    if (!current) return;
    updateTab(
      tabId,
      recovery
        ? { lastRecoveryRevision: revision }
        : {
            filePath: path,
            lastSavedRevision: revision,
            lastSavedHash: hash,
            saveState: current.documentRevision === revision ? 'clean' : 'dirty'
          }
    );
    if (!recovery) {
      await removeRecovery(tabId);
      await upsertProject(path, tab.document, hash, true);
      await persistWorkspaceLayout();
      workspaceNotice.set(
        thumbnailResult.warnings.length
          ? thumbnailResult.warnings.join('\n')
          : 'Presentation saved.'
      );
    } else await upsertRecovery(tabId, path, tab, hash);
  } catch (error) {
    updateTab(tabId, { saveState: 'error', error: String(error) });
    if (recovery && database)
      await database.execute(
        "UPDATE recovery_drafts SET status='failed', updated_at=? WHERE tab_id=?",
        [new Date().toISOString(), tabId]
      );
    throw error;
  }
}

function updateTab(tabId: string, changes: Partial<WorkspaceTab>): void {
  workspaceStore.update((state) => ({
    ...state,
    tabs: state.tabs.map((tab) =>
      tab.id === tabId ? { ...tab, ...changes } : tab
    )
  }));
}

export async function saveTab(tabId: string): Promise<boolean> {
  const tab = get(workspaceStore).tabs.find((item) => item.id === tabId);
  if (!tab) return false;
  if (!tab.filePath) return saveTabAs(tabId);
  await writeTab(tabId, tab.filePath, false);
  return true;
}

export async function saveTabAs(tabId: string): Promise<boolean> {
  if (!isTauri()) {
    workspaceNotice.set('Save As is available in the Tauri desktop app.');
    return false;
  }
  const tab = get(workspaceStore).tabs.find((item) => item.id === tabId);
  if (!tab) return false;
  const path = await save({
    defaultPath: `${tab.document.title || 'Untitled'}.slaides`,
    filters: [{ name: 'SlAIdes presentation', extensions: ['slaides'] }]
  });
  if (!path) return false;
  await writeTab(
    tabId,
    path.endsWith('.slaides') ? path : `${path}.slaides`,
    false
  );
  return true;
}

export async function saveActiveTab(): Promise<boolean> {
  return saveTab(get(workspaceStore).activeTabId);
}

export async function openDocument(): Promise<void> {
  if (!isTauri()) {
    workspaceNotice.set('Open is available in the Tauri desktop app.');
    return;
  }
  const path = await open({
    multiple: false,
    directory: false,
    filters: [{ name: 'SlAIdes presentation', extensions: ['slaides'] }]
  });
  if (typeof path === 'string') await openDocumentTab(path);
}

export async function openDocumentTab(path: string): Promise<void> {
  const existing = get(workspaceStore).tabs.find(
    (tab) => tab.filePath === path
  );
  if (existing) return activateTab(existing.id);
  const result = await projectRepository.open(path);
  const document = deserializeSlideDocument(result.documentJson);
  const urls: Array<[string, string]> = [];
  for (const asset of document.assets) {
    const payload = result.assets.find(
      (entry) => entry.path === asset.localPath
    );
    if (payload)
      urls.push([
        asset.id,
        URL.createObjectURL(
          new Blob([new Uint8Array(payload.bytes)], { type: asset.mimeType })
        )
      ]);
  }
  captureActiveTab();
  const id = crypto.randomUUID();
  const session: EditorSnapshot = {
    document,
    activeSlideId: document.slides[0].id,
    selectedElementIds: [],
    documentRevision: 0
  };
  const tab = tabFromRuntime(
    id,
    { session, history: createHistoryState(100), zoom: 1, assetUrls: urls },
    path,
    recoveryRoot ? `${recoveryRoot}/${id}.slaides` : ''
  );
  tab.lastSavedHash = await documentHash(document);
  const state = get(workspaceStore);
  workspaceStore.set({ ...state, tabs: [...state.tabs, tab] });
  await upsertProject(path, document, tab.lastSavedHash, false);
  activateTab(id);
}

export function scheduleRecoverySave(tabId: string): void {
  const old = autosaveTimers.get(tabId);
  if (old) clearTimeout(old);
  autosaveTimers.set(
    tabId,
    setTimeout(async () => {
      autosaveTimers.delete(tabId);
      const tab = get(workspaceStore).tabs.find((item) => item.id === tabId);
      if (
        !tab ||
        tab.documentRevision === tab.lastRecoveryRevision ||
        get(canvasTextEditingStore) ||
        tab.saveState === 'saving' ||
        !isTauri() ||
        !tab.recoveryPath
      )
        return;
      try {
        await writeTab(tabId, tab.recoveryPath, true);
      } catch {
        /* state contains error */
      }
    }, 2000)
  );
}

async function confirmClose(tab: WorkspaceTab): Promise<CloseDecision> {
  if (!isTabDirty(tab)) return 'discard';
  return new Promise<CloseDecision>((resolve) => {
    closePromptQueue.push({
      prompt: {
        tabId: tab.id,
        title: workspaceTabTitle(tab),
        filePath: tab.filePath
      },
      resolve
    });
    presentNextClosePrompt();
  });
}

function presentNextClosePrompt(): void {
  if (activeClosePrompt) return;
  activeClosePrompt = closePromptQueue.shift();
  closePromptStore.set(activeClosePrompt?.prompt);
}

export function resolveClosePrompt(decision: CloseDecision): void {
  const current = activeClosePrompt;
  if (!current) return;
  activeClosePrompt = undefined;
  closePromptStore.set(undefined);
  current.resolve(decision);
  queueMicrotask(presentNextClosePrompt);
}

export function requestCloseTab(tabId: string): Promise<CloseTabResult> {
  const running = closeRequests.get(tabId);
  if (running) return running;
  const request: Promise<CloseTabResult> =
    (async (): Promise<CloseTabResult> => {
      const tab = get(workspaceStore).tabs.find((item) => item.id === tabId);
      if (!tab) return { type: 'closed' } as CloseTabResult;
      updateTab(tabId, { closeState: 'confirming' });
      const decision = await confirmClose(tab);
      if (decision === 'cancel') {
        updateTab(tabId, { closeState: 'idle' });
        return { type: 'cancelled' };
      }
      if (decision === 'save') {
        updateTab(tabId, { closeState: 'saving' });
        try {
          if (!(await saveTab(tabId))) {
            updateTab(tabId, { closeState: 'idle' });
            return { type: 'cancelled' };
          }
        } catch (error) {
          updateTab(tabId, { closeState: 'idle' });
          return { type: 'save-failed', error: String(error) };
        }
      } else await removeRecovery(tabId);
      performCloseTab(tabId);
      return { type: 'closed' };
    })();
  closeRequests.set(tabId, request);
  void request.finally(() => closeRequests.delete(tabId));
  return request;
}

export function performCloseTab(tabId: string): void {
  const state = get(workspaceStore);
  const tab = state.tabs.find((item) => item.id === tabId);
  if (!tab) return;
  for (const url of tab.assets.objectUrls.values()) URL.revokeObjectURL(url);
  if (isTauri()) void projectRepository.discardStagedAssets(tabId);
  const tabs = state.tabs.filter((item) => item.id !== tabId);
  if (!tabs.length) {
    workspaceStore.set({ ...state, tabs: [], activeTabId: '' });
    void persistWorkspaceLayout();
    return;
  }
  const nextId =
    state.activeTabId === tabId
      ? tabs[Math.max(0, state.tabs.indexOf(tab) - 1)].id
      : state.activeTabId;
  workspaceStore.set({ ...state, tabs, activeTabId: state.activeTabId });
  if (state.activeTabId === tabId) {
    switching = true;
    workspaceStore.update((current) => ({ ...current, activeTabId: nextId }));
    restoreEditorRuntime(
      runtimeFromTab(tabs.find((item) => item.id === nextId)!)
    );
    switching = false;
  }
  void persistWorkspaceLayout();
}

export async function requestCloseWindow(): Promise<CloseTabResult> {
  for (const tab of [...get(workspaceStore).tabs]) {
    const result = await requestCloseTab(tab.id);
    if (result.type !== 'closed') return result;
  }
  return { type: 'closed' };
}

async function initDatabase(): Promise<void> {
  if (!isTauri()) return;
  database = await Database.load('sqlite:slaides.db');
}

async function upsertProject(
  path: string,
  document: SlideDocument,
  hash: string,
  saved: boolean
): Promise<void> {
  if (!database) return;
  const now = new Date().toISOString();
  await database.execute(
    `INSERT INTO project_index(path, document_id, title, last_opened_at, last_saved_at, document_hash, is_missing)
    VALUES (?, ?, ?, ?, ?, ?, 0) ON CONFLICT(path) DO UPDATE SET title=excluded.title, last_opened_at=excluded.last_opened_at,
    last_saved_at=COALESCE(excluded.last_saved_at, project_index.last_saved_at), document_hash=excluded.document_hash, is_missing=0`,
    [path, document.id, document.title, now, saved ? now : null, hash]
  );
  await refreshRecentProjects();
}

async function refreshRecentProjects(): Promise<void> {
  if (!database) return;
  const rows = await database.select<
    Array<{ path: string; title: string; last_opened_at: string }>
  >(
    'SELECT path, title, last_opened_at FROM project_index WHERE is_missing=0 ORDER BY last_opened_at DESC LIMIT 10'
  );
  recentProjectsStore.set(
    rows.map((row) => ({
      path: row.path,
      title: row.title,
      lastOpenedAt: row.last_opened_at
    }))
  );
}

async function upsertRecovery(
  tabId: string,
  path: string,
  tab: WorkspaceTab,
  hash: string
): Promise<void> {
  if (!database) return;
  await database.execute(
    `INSERT INTO recovery_drafts(tab_id, original_path, recovery_path, title, document_hash, document_revision, updated_at, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'ready') ON CONFLICT(tab_id) DO UPDATE SET recovery_path=excluded.recovery_path,
    title=excluded.title, document_hash=excluded.document_hash, document_revision=excluded.document_revision, updated_at=excluded.updated_at, status='ready'`,
    [
      tabId,
      tab.filePath,
      path,
      tab.document.title,
      hash,
      tab.documentRevision,
      new Date().toISOString()
    ]
  );
}

async function markRecoveryWriting(
  tabId: string,
  path: string,
  tab: WorkspaceTab,
  hash: string
): Promise<void> {
  if (!database) return;
  await database.execute(
    `INSERT INTO recovery_drafts(tab_id, original_path, recovery_path, title, document_hash, document_revision, updated_at, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'writing') ON CONFLICT(tab_id) DO UPDATE SET original_path=excluded.original_path,
    recovery_path=excluded.recovery_path, title=excluded.title, document_hash=excluded.document_hash,
    document_revision=excluded.document_revision, updated_at=excluded.updated_at, status='writing'`,
    [
      tabId,
      tab.filePath,
      path,
      tab.document.title,
      hash,
      tab.documentRevision,
      new Date().toISOString()
    ]
  );
}

async function removeRecovery(tabId: string): Promise<void> {
  const recoveryPath = get(workspaceStore).tabs.find(
    (tab) => tab.id === tabId
  )?.recoveryPath;
  if (isTauri() && recoveryPath) {
    try {
      await projectRepository.discardRecovery(recoveryPath);
    } catch {
      // An already-missing draft should not remain in the recovery index.
    }
  }
  if (database)
    await database.execute('DELETE FROM recovery_drafts WHERE tab_id = ?', [
      tabId
    ]);
}

async function openRecoveryTab(row: RecoveryRow): Promise<void> {
  const result: OpenProjectResult = await projectRepository.inspectRecovery(
    row.recovery_path
  );
  const document = deserializeSlideDocument(result.documentJson);
  const urls: Array<[string, string]> = [];
  for (const asset of document.assets) {
    const payload = result.assets.find(
      (entry) => entry.path === asset.localPath
    );
    if (payload)
      urls.push([
        asset.id,
        URL.createObjectURL(
          new Blob([new Uint8Array(payload.bytes)], { type: asset.mimeType })
        )
      ]);
  }
  const session: EditorSnapshot = {
    document,
    activeSlideId: document.slides[0].id,
    selectedElementIds: [],
    documentRevision: row.document_revision
  };
  const tab = tabFromRuntime(
    row.tab_id,
    { session, history: createHistoryState(100), zoom: 1, assetUrls: urls },
    row.original_path,
    row.recovery_path
  );
  tab.saveState = 'dirty';
  tab.lastSavedRevision = null;
  tab.lastRecoveryRevision = row.document_revision;
  workspaceStore.update((state) => ({
    ...state,
    tabs: [...state.tabs, tab]
  }));
}

async function persistWorkspaceLayout(): Promise<void> {
  if (!database) return;
  const state = get(workspaceStore);
  const value = JSON.stringify({
    paths: state.tabs.map((tab) => tab.filePath).filter(Boolean),
    activePath: state.tabs.find((tab) => tab.id === state.activeTabId)?.filePath
  });
  await database.execute(
    `INSERT INTO settings(key, value_json, updated_at) VALUES ('workspace.tabs', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json, updated_at=excluded.updated_at`,
    [value, new Date().toISOString()]
  );
}

export async function initializeWorkspace(): Promise<void> {
  if (get(workspaceStore).initialized) return;
  if (isTauri()) {
    await initDatabase();
    await refreshRecentProjects();
    recoveryRoot = await join(await appDataDir(), 'recovery');
    workspaceStore.update((state) => ({
      ...state,
      tabs: state.tabs.map((tab) => ({
        ...tab,
        recoveryPath: tab.recoveryPath || `${recoveryRoot}/${tab.id}.slaides`
      }))
    }));
    const stored = await database!.select<Array<{ value_json: string }>>(
      "SELECT value_json FROM settings WHERE key='workspace.tabs'"
    );
    const layout = stored[0]
      ? (JSON.parse(stored[0].value_json) as {
          paths?: string[];
          activePath?: string;
        })
      : {};
    const loadedTabIds = new Set<string>();
    for (const path of layout.paths ?? []) {
      try {
        await openDocumentTab(path);
        const loaded = get(workspaceStore).tabs.find(
          (tab) => tab.filePath === path
        );
        if (loaded) loadedTabIds.add(loaded.id);
      } catch {
        await database!.execute(
          'UPDATE project_index SET is_missing=1 WHERE path=?',
          [path]
        );
      }
    }
    await refreshRecentProjects();
    const recoveries = await database!.select<RecoveryRow[]>(
      "SELECT tab_id, original_path, recovery_path, document_revision FROM recovery_drafts WHERE status='ready' ORDER BY updated_at"
    );
    for (const recovery of recoveries) {
      try {
        await openRecoveryTab(recovery);
        loadedTabIds.add(recovery.tab_id);
      } catch {
        await database!.execute(
          "UPDATE recovery_drafts SET status='failed' WHERE tab_id=?",
          [recovery.tab_id]
        );
      }
    }
    if (loadedTabIds.size) {
      const state = get(workspaceStore);
      const tabs = state.tabs.filter((tab) => loadedTabIds.has(tab.id));
      workspaceStore.set({
        ...state,
        tabs,
        activeTabId: tabs[0]?.id ?? ''
      });
      if (tabs[0]) restoreEditorRuntime(runtimeFromTab(tabs[0]));
    }
    const active = get(workspaceStore).tabs.find(
      (tab) => tab.filePath === layout.activePath
    );
    if (active) activateTab(active.id);
  }
  workspaceStore.update((state) => ({ ...state, initialized: true }));
}

export function disposeWorkspace(): void {
  captureActiveTab();
  const tabs = get(workspaceStore).tabs;
  const urls = new Set(
    tabs.flatMap((tab) => [...tab.assets.objectUrls.values()])
  );
  for (const timer of autosaveTimers.values()) clearTimeout(timer);
  autosaveTimers.clear();
  for (const url of urls) URL.revokeObjectURL(url);
  if (isTauri())
    for (const tab of tabs) void projectRepository.discardStagedAssets(tab.id);
  disposeAssets();
}
