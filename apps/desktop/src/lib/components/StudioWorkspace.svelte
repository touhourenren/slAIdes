<script lang="ts">
  import CanvasPanel from './CanvasPanel.svelte';
  import InspectorSidebar from './InspectorSidebar.svelte';
  import MainToolbar from './MainToolbar.svelte';
  import SlideSidebar from './SlideSidebar.svelte';

  export let chooseImage: () => void;
  let inspectorOpen = true;
  let leftWidth = 240;
  let rightWidth = 304;
  let resizing: 'left' | 'right' | undefined;

  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));
  const startResize = (side: 'left' | 'right', event: PointerEvent) => {
    resizing = side;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };
  const resize = (event: PointerEvent) => {
    if (resizing === 'left') leftWidth = clamp(event.clientX - 8, 190, 360);
    if (resizing === 'right')
      rightWidth = clamp(window.innerWidth - event.clientX - 8, 260, 460);
  };
  const resizeWithKeyboard = (side: 'left' | 'right', event: KeyboardEvent) => {
    const delta =
      event.key === 'ArrowLeft' ? -12 : event.key === 'ArrowRight' ? 12 : 0;
    if (!delta) return;
    event.preventDefault();
    if (side === 'left') leftWidth = clamp(leftWidth + delta, 190, 360);
    else rightWidth = clamp(rightWidth - delta, 260, 460);
  };
</script>

<div
  class:inspector-closed={!inspectorOpen}
  class="studio-workspace"
  style={`--left-panel-width:${leftWidth}px;--right-panel-width:${rightWidth}px`}
>
  <SlideSidebar />
  <button
    type="button"
    class="workspace-resizer"
    class:dragging={resizing === 'left'}
    aria-label="Resize slides panel"
    onpointerdown={(event) => startResize('left', event)}
    onpointermove={resize}
    onpointerup={() => (resizing = undefined)}
    onkeydown={(event) => resizeWithKeyboard('left', event)}
  ></button>
  <main class="editor-column">
    <MainToolbar
      {chooseImage}
      {inspectorOpen}
      toggleInspector={() => (inspectorOpen = !inspectorOpen)}
    />
    <section class="canvas-region" aria-label="Slide canvas">
      <CanvasPanel />
    </section>
  </main>
  {#if inspectorOpen}
    <button
      type="button"
      class="workspace-resizer"
      class:dragging={resizing === 'right'}
      aria-label="Resize inspector panel"
      onpointerdown={(event) => startResize('right', event)}
      onpointermove={resize}
      onpointerup={() => (resizing = undefined)}
      onkeydown={(event) => resizeWithKeyboard('right', event)}
    ></button>
    <InspectorSidebar />
  {/if}
</div>
