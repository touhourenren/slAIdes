<script lang="ts">
  import { onMount } from 'svelte';
  import { isTauri } from '@tauri-apps/api/core';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import AppHeader from '$lib/components/AppHeader.svelte';
  import DocumentTabs from '$lib/components/DocumentTabs.svelte';
  import EmptyWorkspace from '$lib/components/EmptyWorkspace.svelte';
  import SaveChangesDialog from '$lib/components/SaveChangesDialog.svelte';
  import { installNativeMenu } from '$lib/native-menu';
  import StatusBar from '$lib/components/StatusBar.svelte';
  import StudioWorkspace from '$lib/components/StudioWorkspace.svelte';
  import {
    canvasTextEditingStore,
    canRedoStore,
    canUndoStore,
    deleteSelected,
    duplicateSelected,
    insertImage,
    redo,
    undo
  } from '$lib/stores/editor';
  import { get } from 'svelte/store';
  import {
    disposeWorkspace,
    initializeWorkspace,
    newDocumentTab,
    openDocument,
    requestCloseTab,
    requestCloseWindow,
    saveActiveTab,
    saveTabAs,
    workspaceNotice,
    workspaceStore,
    workspaceTabTitle
  } from '$lib/stores/workspace';

  let fileInput: HTMLInputElement;
  let pageTitle = 'SlAIdes';
  const chooseImage = () => fileInput.click();

  onMount(() => {
    void initializeWorkspace();
    const unsubscribeTitle = workspaceStore.subscribe((state) => {
      const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId);
      pageTitle = activeTab
        ? `${workspaceTabTitle(activeTab)} — SlAIdes`
        : 'SlAIdes';
      if (isTauri()) void getCurrentWindow().setTitle(pageTitle);
    });
    let removeCloseListener: (() => void) | undefined;
    if (isTauri()) {
      void installNativeMenu({
        newDocument: newDocumentTab,
        openDocument: () => void openDocument(),
        saveDocument: () => void saveActiveTab(),
        saveDocumentAs: () => {
          const tabId = get(workspaceStore).activeTabId;
          if (tabId) void saveTabAs(tabId);
        },
        closeDocument: () => {
          const tabId = get(workspaceStore).activeTabId;
          if (tabId) void requestCloseTab(tabId);
        },
        quit: () => {
          void requestCloseWindow().then((result) => {
            if (result.type === 'closed') void getCurrentWindow().destroy();
          });
        },
        undo: () => {
          if (get(canUndoStore)) undo();
        },
        redo: () => {
          if (get(canRedoStore)) redo();
        }
      });
      void getCurrentWindow()
        .onCloseRequested(async (event) => {
          event.preventDefault();
          const result = await requestCloseWindow();
          if (result.type === 'closed') await getCurrentWindow().destroy();
        })
        .then((unlisten) => (removeCloseListener = unlisten));
    }
    const key = (event: KeyboardEvent) => {
      const target = event.target;
      const isEditingField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable) ||
        get(canvasTextEditingStore);
      const modifier = event.metaKey || event.ctrlKey;
      if (!isEditingField && modifier && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (event.shiftKey) void saveTabAs(get(workspaceStore).activeTabId);
        else void saveActiveTab();
        return;
      }
      if (!isEditingField && modifier && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        newDocumentTab();
        return;
      }
      if (!isEditingField && modifier && event.key.toLowerCase() === 'o') {
        event.preventDefault();
        void openDocument();
        return;
      }
      if (!isEditingField && modifier && event.key.toLowerCase() === 'w') {
        event.preventDefault();
        void requestCloseTab(get(workspaceStore).activeTabId);
        return;
      }
      if (!isEditingField && modifier && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          if (get(canRedoStore)) redo();
        } else if (get(canUndoStore)) undo();
        return;
      }
      if (
        !isEditingField &&
        event.ctrlKey &&
        !event.metaKey &&
        event.key.toLowerCase() === 'y'
      ) {
        event.preventDefault();
        if (get(canRedoStore)) redo();
        return;
      }
      if (!isEditingField && modifier && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        duplicateSelected();
        return;
      }
      if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        !isEditingField
      ) {
        event.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('keydown', key);
      removeCloseListener?.();
      unsubscribeTitle();
      disposeWorkspace();
    };
  });

  async function handleImage(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) await insertImage(file);
    input.value = '';
  }
</script>

<svelte:head
  ><title>{pageTitle}</title><meta
    name="description"
    content="SlAIdes slide editor"
  /></svelte:head
>

<main class="editor-shell">
  <AppHeader />
  <DocumentTabs />
  {#if $workspaceStore.tabs.length}
    <StudioWorkspace {chooseImage} />
  {:else}
    <EmptyWorkspace />
  {/if}
  {#if $workspaceStore.tabs.length}<StatusBar />{:else}<div
      class="empty-status-bar"
    ></div>{/if}
  <input
    class="hidden-input"
    bind:this={fileInput}
    type="file"
    accept="image/*"
    onchange={handleImage}
  />
  {#if $workspaceNotice}
    <button
      class="workspace-notice"
      aria-label="Dismiss notification"
      onclick={() => workspaceNotice.set(undefined)}>{$workspaceNotice}</button
    >
  {/if}
  <SaveChangesDialog />
</main>
