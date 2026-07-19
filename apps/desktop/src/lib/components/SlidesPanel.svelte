<script lang="ts">
  import { flushSync } from 'svelte';
  import {
    activeSlideId,
    documentStore,
    moveSlide,
    selectSlide
  } from '../stores/editor';
  import SlideThumbnail from './SlideThumbnail.svelte';
  let dragging = -1;
  let dropTarget = -1;
  let dragPreview: HTMLDivElement;
  let dragPreviewText = '';

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
</script>

<div class="slides-panel">
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
