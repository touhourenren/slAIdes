<script lang="ts">
  import { flushSync } from 'svelte';
  import {
    activeSlideId,
    addNewSlide,
    copySlide,
    cutSlide,
    deleteActiveSlide,
    documentStore,
    duplicateActiveSlide,
    editorClipboardStore,
    moveSlide,
    pasteClipboardSlide,
    selectSlide
  } from '../stores/editor';
  import SlideThumbnail from './SlideThumbnail.svelte';
  let dragging = -1;
  let dropTarget = -1;
  let dragPreview: HTMLDivElement;
  let dragPreviewText = '';
  let contextMenu:
    { x: number; y: number; slideId: string; canDelete: boolean } | undefined;

  function startDrag(event: DragEvent, index: number, name: string) {
    dragging = index;
    dropTarget = index;
    flushSync(() => (dragPreviewText = `${index + 1}  ${name}`));
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
      event.dataTransfer.setDragImage(dragPreview, 18, 18);
    }
  }

  function finishDrag() {
    dragging = -1;
    dropTarget = -1;
  }

  function drop(index: number) {
    if (dragging >= 0 && dragging !== index) moveSlide(dragging, index);
    finishDrag();
  }

  function openContextMenu(event: MouseEvent, slideId: string) {
    event.preventDefault();
    event.stopPropagation();
    selectSlide(slideId);
    contextMenu = {
      x: Math.min(event.clientX, window.innerWidth - 190),
      y: Math.min(event.clientY, window.innerHeight - 250),
      slideId,
      canDelete: $documentStore.slides.length > 1
    };
  }

  function openEmptyContextMenu(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.closest('.thumbnail-wrap')) return;
    event.preventDefault();
    const slideId = $activeSlideId;
    if (!slideId) return;
    contextMenu = {
      x: Math.min(event.clientX, window.innerWidth - 190),
      y: Math.min(event.clientY, window.innerHeight - 290),
      slideId,
      canDelete: $documentStore.slides.length > 1
    };
  }
</script>

<svelte:window
  onclick={() => (contextMenu = undefined)}
  onkeydown={(event) => {
    if (event.key === 'Escape') contextMenu = undefined;
  }}
/>

<div
  class="slides-panel"
  role="region"
  aria-label="Slide list"
  oncontextmenu={openEmptyContextMenu}
>
  <div class:is-dragging={dragging >= 0} class="filmstrip">
    {#each $documentStore.slides as slide, index (slide.id)}<button
        class:active={$activeSlideId === slide.id}
        class:drag-source={dragging === index}
        class:drop-target={dropTarget === index && dragging !== index}
        class="thumbnail-wrap"
        data-title={slide.name ?? `Slide ${index + 1}`}
        title={slide.name ?? `Slide ${index + 1}`}
        aria-label={`Slide ${index + 1}: ${slide.name ?? 'Untitled'}`}
        aria-pressed={$activeSlideId === slide.id}
        draggable="true"
        ondragstart={(event) =>
          startDrag(event, index, slide.name ?? `Slide ${index + 1}`)}
        ondragenter={() => (dropTarget = index)}
        ondragover={(e) => e.preventDefault()}
        ondrop={() => drop(index)}
        ondragend={finishDrag}
        onclick={() => selectSlide(slide.id)}
        oncontextmenu={(event) => openContextMenu(event, slide.id)}
        ><span class="number">{index + 1}</span><span class="thumbnail"
          ><SlideThumbnail
            {slide}
            size={$documentStore.size}
            assets={$documentStore.assets}
          /></span
        ></button
      >{/each}
  </div>
  <div bind:this={dragPreview} class="slide-drag-preview" aria-hidden="true">
    {dragPreviewText}
  </div>
</div>

{#if contextMenu}
  <div
    class="slide-context-menu"
    style:left={`${contextMenu.x}px`}
    style:top={`${contextMenu.y}px`}
    role="menu"
    tabindex="-1"
  >
    <button
      role="menuitem"
      onclick={() => {
        addNewSlide();
        contextMenu = undefined;
      }}>New slide</button
    >
    <div></div>
    <button
      role="menuitem"
      onclick={() => {
        copySlide(contextMenu!.slideId);
        contextMenu = undefined;
      }}>Copy slide <kbd>⌘C</kbd></button
    >
    <button
      role="menuitem"
      disabled={!contextMenu.canDelete}
      onclick={() => {
        cutSlide(contextMenu!.slideId);
        contextMenu = undefined;
      }}>Cut slide <kbd>⌘X</kbd></button
    >
    <button
      role="menuitem"
      disabled={$editorClipboardStore?.type !== 'slide'}
      onclick={() => {
        pasteClipboardSlide(contextMenu!.slideId);
        contextMenu = undefined;
      }}>Paste after <kbd>⌘V</kbd></button
    >
    <div></div>
    <button
      role="menuitem"
      onclick={() => {
        duplicateActiveSlide();
        contextMenu = undefined;
      }}>Duplicate slide</button
    >
    <button
      class="danger"
      role="menuitem"
      disabled={!contextMenu.canDelete}
      onclick={() => {
        deleteActiveSlide();
        contextMenu = undefined;
      }}>Delete slide <kbd>⌫</kbd></button
    >
  </div>
{/if}

<style>
  .slide-context-menu {
    position: fixed;
    z-index: 950;
    width: 180px;
    border: 1px solid var(--color-border-subtle);
    border-radius: 8px;
    background: var(--color-panel-bg);
    padding: 5px;
    box-shadow: var(--material-shadow);
  }
  .slide-context-menu button {
    display: flex;
    width: 100%;
    min-height: 30px;
    align-items: center;
    justify-content: space-between;
    border: 0;
    border-radius: 5px;
    background: transparent;
    color: var(--color-text-primary);
    padding: 0 8px;
    font-size: 12px;
  }
  .slide-context-menu button:hover:not(:disabled) {
    background: var(--color-hover-bg);
  }
  .slide-context-menu button:disabled {
    opacity: 0.42;
  }
  .slide-context-menu > div {
    height: 1px;
    margin: 4px 6px;
    background: var(--color-border-subtle);
  }
  .slide-context-menu .danger {
    color: var(--color-danger);
  }
  .slide-context-menu kbd {
    color: var(--color-text-muted);
    font: inherit;
  }
</style>
