<script lang="ts">
  import {
    activeSlide,
    moveLayer,
    patchElement,
    selectElements,
    selectedElementIds
  } from '../stores/editor';
  const icon = (type: string) =>
    ({ text: 'T', image: '▧', shape: '◆', line: '╱', group: '⌘' })[type] ?? '•';
</script>

<div class="panel-body">
  <div class="panel-heading">
    <span>Objects</span><span class="count"
      >{$activeSlide?.elements.length ?? 0}</span
    >
  </div>
  <div class="layers">
    {#each [...($activeSlide?.elements ?? [])].sort((a, b) => b.zIndex - a.zIndex) as element (element.id)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <button
        class:active={$selectedElementIds.includes(element.id)}
        class="layer"
        onclick={() => selectElements([element.id])}
        ><span class="type">{icon(element.type)}</span><span class="name"
          >{element.type === 'text'
            ? element.text || 'Text'
            : element.type}</span
        ><span class="tools"
          ><span
            role="button"
            tabindex="0"
            onclick={(e) => {
              e.stopPropagation();
              patchElement(element.id, { hidden: !element.hidden });
            }}>{element.hidden ? '○' : '●'}</span
          ><span
            role="button"
            tabindex="0"
            onclick={(e) => {
              e.stopPropagation();
              patchElement(element.id, { locked: !element.locked });
            }}>{element.locked ? '▣' : '▢'}</span
          ></span
        ></button
      >
    {/each}
  </div>
  {#if $selectedElementIds[0]}<div class="layer-actions">
      <button onclick={() => moveLayer($selectedElementIds[0], 'back')}
        >⇤</button
      ><button onclick={() => moveLayer($selectedElementIds[0], 'backward')}
        >←</button
      ><button onclick={() => moveLayer($selectedElementIds[0], 'forward')}
        >→</button
      ><button onclick={() => moveLayer($selectedElementIds[0], 'front')}
        >⇥</button
      >
    </div>{/if}
</div>
