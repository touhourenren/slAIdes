<script lang="ts">
  import { Layers3, SlidersHorizontal, Sparkles } from 'lucide-svelte';
  import AiPanel from './AiPanel.svelte';
  import LayersPanel from './LayersPanel.svelte';
  import PropertiesPanel from './PropertiesPanel.svelte';

  type InspectorTab = 'design' | 'layers' | 'ai';
  let tab: InspectorTab = 'design';
</script>

<aside class="inspector-sidebar" aria-label="Inspector">
  <nav class="inspector-tabs" aria-label="Inspector panels">
    <button
      class:active={tab === 'design'}
      aria-pressed={tab === 'design'}
      onclick={() => (tab = 'design')}><SlidersHorizontal />Design</button
    >
    <button
      class:active={tab === 'layers'}
      aria-pressed={tab === 'layers'}
      onclick={() => (tab = 'layers')}><Layers3 />Layers</button
    >
    <button
      class:active={tab === 'ai'}
      class="ai-tab"
      aria-pressed={tab === 'ai'}
      onclick={() => (tab = 'ai')}><Sparkles />AI</button
    >
  </nav>
  <div class="inspector-content">
    {#if tab === 'design'}<PropertiesPanel
      />{:else if tab === 'layers'}<LayersPanel />{:else}<AiPanel />{/if}
  </div>
</aside>
