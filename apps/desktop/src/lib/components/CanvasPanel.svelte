<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { CanvasController, zoomOffsetAtPoint } from '@slaides/canvas-fabric';
  import { Copy, ClipboardPaste, Scissors, Trash2 } from 'lucide-svelte';
  import {
    activeSlide,
    canvasTextEditingStore,
    closeHistoryGroup,
    copySelected,
    cutSelected,
    deleteSelected,
    documentStore,
    editorClipboardStore,
    patchElement,
    pasteClipboardObjects,
    resolveAssetUrl,
    selectElements,
    setTextSelection,
    selectedElementIds,
    zoomStore
  } from '../stores/editor';
  let canvas: HTMLCanvasElement;
  let host: HTMLDivElement;
  let controller: CanvasController | undefined;
  let space = false;
  let panning = false;
  let last = { x: 0, y: 0 };
  let offset = { x: 0, y: 0 };
  let gestureStartZoom = 1;
  let fittedWidth = 960;
  let contextMenu: { x: number; y: number; hasTarget: boolean } | undefined;

  type WebKitGestureEvent = Event & {
    scale: number;
    clientX: number;
    clientY: number;
  };

  onMount(() => {
    const document = $documentStore;
    controller = CanvasController.mount(canvas, {
      size: document.size,
      resolveAsset: resolveAssetUrl,
      onEvent: (event) => {
        if (event.type === 'selectionChanged') selectElements(event.elementIds);
        else if (event.type === 'elementModified')
          patchElement(event.elementId, event.changes, {
            label: 'Transform object'
          });
        else if (event.type === 'elementTextChanged')
          patchElement(
            event.elementId,
            { text: event.text, textStyles: event.textStyles },
            {
              label: 'Edit text',
              mergeKey: `canvas-text:${event.elementId}`
            }
          );
        else if (event.type === 'textSelectionChanged')
          setTextSelection({
            elementId: event.elementId,
            start: event.start,
            end: event.end
          });
        else if (event.type === 'contextMenuRequested')
          contextMenu = {
            x: Math.min(event.clientX, window.innerWidth - 190),
            y: Math.min(event.clientY, window.innerHeight - 210),
            hasTarget: Boolean(event.elementId)
          };
        else {
          canvasTextEditingStore.set(event.editing);
          if (!event.editing)
            closeHistoryGroup(
              event.elementId ? `canvas-text:${event.elementId}` : undefined
            );
        }
      }
    });
    let currentSlideId: string | undefined;
    const unsubscribeSlide = activeSlide.subscribe((slide) => {
      if (!slide) return;
      const assets = get(documentStore).assets;
      if (currentSlideId === slide.id)
        void controller?.reconcileSlide(slide, assets);
      else {
        currentSlideId = slide.id;
        void controller?.replaceSlide(slide, assets);
      }
    });
    const unsubscribeSelection = selectedElementIds.subscribe((ids) =>
      controller?.setSelection(ids)
    );
    const unsubscribeZoom = zoomStore.subscribe((zoom) => {
      if (zoom === 1) offset = { x: 0, y: 0 };
      controller?.setZoom(zoom);
    });
    const resizeObserver = new ResizeObserver(() => {
      const horizontalFit = host.clientWidth * 0.88;
      const verticalFit = (host.clientHeight * 0.82 * 16) / 9;
      fittedWidth = Math.max(320, Math.min(1200, horizontalFit, verticalFit));
    });
    resizeObserver.observe(host);
    const down = (event: KeyboardEvent) => {
      if (
        event.code === 'Space' &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement)
      ) {
        space = true;
        event.preventDefault();
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        space = false;
        panning = false;
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    const gestureStart = (rawEvent: Event) => {
      const event = rawEvent as WebKitGestureEvent;
      gestureStartZoom = get(zoomStore);
      event.preventDefault();
    };
    const gestureChange = (rawEvent: Event) => {
      const event = rawEvent as WebKitGestureEvent;
      zoomAt(
        gestureStartZoom * event.scale,
        event.clientX ||
          host.getBoundingClientRect().left + host.clientWidth / 2,
        event.clientY ||
          host.getBoundingClientRect().top + host.clientHeight / 2
      );
      event.preventDefault();
    };
    host.addEventListener('gesturestart', gestureStart, { passive: false });
    host.addEventListener('gesturechange', gestureChange, { passive: false });
    return () => {
      unsubscribeSlide();
      unsubscribeSelection();
      unsubscribeZoom();
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      host.removeEventListener('gesturestart', gestureStart);
      host.removeEventListener('gesturechange', gestureChange);
      resizeObserver.disconnect();
      canvasTextEditingStore.set(false);
      controller?.dispose();
    };
  });
  function pointerDown(event: PointerEvent) {
    if (!space) return;
    panning = true;
    last = { x: event.clientX, y: event.clientY };
    host.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent) {
    if (!panning) return;
    offset = {
      x: offset.x + event.clientX - last.x,
      y: offset.y + event.clientY - last.y
    };
    last = { x: event.clientX, y: event.clientY };
  }

  function zoomAt(rawZoom: number, clientX: number, clientY: number) {
    const currentZoom = get(zoomStore);
    const nextZoom = Math.max(0.25, Math.min(4, rawZoom));
    if (Math.abs(nextZoom - currentZoom) < 0.001) return;
    const bounds = host.getBoundingClientRect();
    const pointer = {
      x: clientX - bounds.left - bounds.width / 2,
      y: clientY - bounds.top - bounds.height / 2
    };
    offset = zoomOffsetAtPoint(currentZoom, nextZoom, offset, pointer);
    zoomStore.set(nextZoom);
  }

  function wheel(event: WheelEvent) {
    event.preventDefault();
    const multiplier = event.deltaMode === 1 ? 16 : 1;
    if (event.ctrlKey || event.metaKey) {
      zoomAt(
        get(zoomStore) * Math.exp(-event.deltaY * multiplier * 0.002),
        event.clientX,
        event.clientY
      );
      return;
    }
    offset = {
      x:
        offset.x -
        (event.deltaX + (event.shiftKey ? event.deltaY : 0)) * multiplier,
      y: offset.y - (event.shiftKey ? 0 : event.deltaY) * multiplier
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
  bind:this={host}
  role="application"
  aria-label="Slide canvas"
  class:cursor-grabbing={panning}
  class:cursor-grab={space}
  class="canvas-host"
  onpointerdown={pointerDown}
  onpointermove={pointerMove}
  onpointerup={() => (panning = false)}
  onwheel={wheel}
>
  <div
    class="canvas-stage"
    style:width={`${fittedWidth * $zoomStore}px`}
    style:height={`${(fittedWidth * $zoomStore * 9) / 16}px`}
    style:transform={`translate(${offset.x}px, ${offset.y}px)`}
  >
    <canvas bind:this={canvas}></canvas>
  </div>
  <div class="canvas-hint">
    Two-finger pan · Pinch or Ctrl + wheel · {Math.round($zoomStore * 100)}%
  </div>
</div>

{#if contextMenu}
  <div
    class="canvas-context-menu"
    style:left={`${contextMenu.x}px`}
    style:top={`${contextMenu.y}px`}
    role="menu"
    tabindex="-1"
  >
    <button
      role="menuitem"
      disabled={!contextMenu.hasTarget}
      onclick={() => {
        copySelected();
        contextMenu = undefined;
      }}><Copy size={14} />Copy <kbd>⌘C</kbd></button
    >
    <button
      role="menuitem"
      disabled={!contextMenu.hasTarget}
      onclick={() => {
        cutSelected();
        contextMenu = undefined;
      }}><Scissors size={14} />Cut <kbd>⌘X</kbd></button
    >
    <button
      role="menuitem"
      disabled={$editorClipboardStore?.type !== 'objects'}
      onclick={() => {
        pasteClipboardObjects();
        contextMenu = undefined;
      }}><ClipboardPaste size={14} />Paste <kbd>⌘V</kbd></button
    >
    <div class="context-separator"></div>
    <button
      class="danger"
      role="menuitem"
      disabled={!contextMenu.hasTarget}
      onclick={() => {
        deleteSelected();
        contextMenu = undefined;
      }}><Trash2 size={14} />Delete <kbd>⌫</kbd></button
    >
  </div>
{/if}

<style>
  .canvas-host {
    position: relative;
    display: grid;
    height: 100%;
    min-height: 0;
    place-items: center;
    overflow: hidden;
    background: radial-gradient(
      circle at 50% 45%,
      var(--color-canvas-surround) 0,
      color-mix(
          in srgb,
          var(--color-canvas-surround) 82%,
          var(--color-canvas-surround-edge)
        )
        46%,
      var(--color-canvas-surround-edge) 100%
    );
  }
  .canvas-stage {
    flex: 0 0 auto;
    transform-origin: center;
    border: 1px solid var(--color-border);
    box-shadow:
      0 20px 52px rgb(0 0 0 / 28%),
      0 1px 2px rgb(0 0 0 / 18%);
    will-change: transform, width, height;
  }
  .canvas-stage :global(.canvas-container) {
    width: 100% !important;
    height: 100% !important;
  }
  .canvas-stage :global(canvas) {
    width: 100% !important;
    height: 100% !important;
  }
  .canvas-hint {
    position: absolute;
    bottom: 12px;
    right: 14px;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    background: color-mix(in srgb, var(--color-toolbar-bg) 88%, transparent);
    backdrop-filter: saturate(160%) blur(18px);
    -webkit-backdrop-filter: saturate(160%) blur(18px);
    padding: 6px 9px;
    color: var(--color-text-secondary);
    font-size: 11px;
  }
  .canvas-context-menu {
    position: fixed;
    z-index: 900;
    width: 180px;
    border: 1px solid var(--color-border-subtle);
    border-radius: 8px;
    background: var(--color-panel-bg);
    padding: 5px;
    box-shadow: var(--material-shadow);
  }
  .canvas-context-menu button {
    display: grid;
    width: 100%;
    min-height: 30px;
    grid-template-columns: 18px 1fr auto;
    align-items: center;
    gap: 6px;
    border: 0;
    border-radius: 5px;
    background: transparent;
    color: var(--color-text-primary);
    padding: 0 8px;
    font-size: 12px;
    text-align: left;
  }
  .canvas-context-menu button:hover:not(:disabled) {
    background: var(--color-hover-bg);
  }
  .canvas-context-menu button:disabled {
    opacity: 0.42;
  }
  .canvas-context-menu .danger {
    color: var(--color-danger);
  }
  .canvas-context-menu kbd {
    color: var(--color-text-muted);
    font: inherit;
  }
  .context-separator {
    height: 1px;
    margin: 4px 6px;
    background: var(--color-border-subtle);
  }
</style>
