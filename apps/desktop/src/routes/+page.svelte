<script lang="ts">
  import { onMount } from 'svelte';
  import AppHeader from '$lib/components/AppHeader.svelte';
  import StatusBar from '$lib/components/StatusBar.svelte';
  import StudioWorkspace from '$lib/components/StudioWorkspace.svelte';
  import {
    deleteSelected,
    disposeAssets,
    insertImage
  } from '$lib/stores/editor';

  let fileInput: HTMLInputElement;
  const chooseImage = () => fileInput.click();

  onMount(() => {
    const key = (event: KeyboardEvent) => {
      if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement) &&
        !(event.target instanceof HTMLSelectElement)
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
