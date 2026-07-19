<script lang="ts">
  import {
    CheckCircle2,
    Grid2X2,
    List,
    Maximize2,
    Minus,
    Plus
  } from 'lucide-svelte';
  import { activeSlideId, documentStore, zoomStore } from '../stores/editor';
  $: slideNumber = Math.max(
    1,
    $documentStore.slides.findIndex((slide) => slide.id === $activeSlideId) + 1
  );
</script>

<footer class="status-bar">
  <div class="status-breadcrumb">
    <span>Presentation</span><i>/</i><span>Section 1</span><i>/</i><strong
      >Slide {slideNumber}</strong
    >
  </div>
  <div class="status-zoom">
    <div class="view-toggle">
      <button class="active" title="Grid view"><Grid2X2 /></button><button
        title="List view"><List /></button
      >
    </div>
    <button
      title="Zoom out"
      onclick={() => zoomStore.update((value) => Math.max(0.25, value - 0.1))}
      ><Minus /></button
    >
    <input
      aria-label="Zoom"
      type="range"
      min="0.25"
      max="4"
      step="0.05"
      value={$zoomStore}
      oninput={(event) => zoomStore.set(Number(event.currentTarget.value))}
    />
    <span>{Math.round($zoomStore * 100)}%</span>
    <button
      title="Zoom in"
      onclick={() => zoomStore.update((value) => Math.min(4, value + 0.1))}
      ><Plus /></button
    >
    <button title="Fit canvas" onclick={() => zoomStore.set(1)}
      ><Maximize2 /></button
    >
  </div>
  <div class="session-state"><CheckCircle2 /> Session changes only</div>
</footer>
