<script lang="ts">
  import { Plus, X, LoaderCircle, AlertCircle } from 'lucide-svelte';
  import {
    activateTab,
    newDocumentTab,
    requestCloseTab,
    workspaceTabTitle,
    workspaceStore
  } from '../stores/workspace';
</script>

<nav class="document-tabs" aria-label="Open presentations">
  <div class="tab-strip">
    {#each $workspaceStore.tabs as tab (tab.id)}
      <div
        class:active={tab.id === $workspaceStore.activeTabId}
        class="document-tab"
        title={tab.filePath ?? tab.document.title}
      >
        <button class="tab-main" onclick={() => activateTab(tab.id)}>
          {#if tab.saveState === 'saving'}<LoaderCircle
              class="tab-spinner"
              size={13}
            />
          {:else if tab.saveState === 'error'}<AlertCircle
              class="tab-error"
              size={13}
            />
          {:else if tab.saveState === 'dirty'}<span class="dirty-dot"
            ></span>{/if}
          <span class="tab-title">{workspaceTabTitle(tab)}</span>
        </button>
        <button
          class="tab-close"
          aria-label={`Close ${workspaceTabTitle(tab)}`}
          onclick={() => void requestCloseTab(tab.id)}><X size={13} /></button
        >
      </div>
    {/each}
  </div>
  <button
    class="new-tab"
    aria-label="New presentation"
    title="New presentation"
    onclick={newDocumentTab}
  >
    <Plus size={15} />
  </button>
</nav>
