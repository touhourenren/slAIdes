<script lang="ts">
  import { onMount } from 'svelte';
  import AppHeader from '$lib/components/AppHeader.svelte';
  import StatusBar from '$lib/components/StatusBar.svelte';
  import StudioWorkspace from '$lib/components/StudioWorkspace.svelte';
  import {
    canvasTextEditingStore,
    canRedoStore,
    canUndoStore,
    deleteSelected,
    disposeAssets,
    duplicateSelected,
    insertImage,
    redo,
    undo
  } from '$lib/stores/editor';
  import { get } from 'svelte/store';

  let fileInput: HTMLInputElement;
  const chooseImage = () => fileInput.click();

  onMount(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target;
      const isEditingField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable) ||
        get(canvasTextEditingStore);
      const modifier = event.metaKey || event.ctrlKey;
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
      disposeAssets();
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
  ><title>SlAIdes Editor</title><meta
    name="description"
    content="SlAIdes slide editor"
  /></svelte:head
>

<main class="editor-shell">
  <AppHeader />
  <StudioWorkspace {chooseImage} />
  <StatusBar />
  <input
    class="hidden-input"
    bind:this={fileInput}
    type="file"
    accept="image/*"
    onchange={handleImage}
  />
</main>
