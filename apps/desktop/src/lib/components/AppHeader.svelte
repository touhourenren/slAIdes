<script lang="ts">
  import { ChevronDown, Play, Save, Share2 } from 'lucide-svelte';
  import {
    newDocumentTab,
    openDocument,
    openDocumentTab,
    recentProjectsStore,
    saveActiveTab,
    saveTabAs,
    workspaceStore
  } from '../stores/workspace';
  let fileMenu = false;
  $: activeTab = $workspaceStore.tabs.find(
    (tab) => tab.id === $workspaceStore.activeTabId
  );
</script>

<header class="app-header">
  <div class="app-menu-bar">
    <span class="wordmark">Sl<span>AI</span>des</span>
    <span class="header-divider"></span>
    <div class="file-popover">
      <button
        class="file-trigger"
        aria-expanded={fileMenu}
        onclick={() => (fileMenu = !fileMenu)}
        >File <ChevronDown size={12} /></button
      >
      {#if fileMenu}
        <div class="file-menu">
          <button
            onclick={() => {
              fileMenu = false;
              newDocumentTab();
            }}>New <span>⌘N</span></button
          >
          <button
            onclick={() => {
              fileMenu = false;
              void openDocument();
            }}>Open… <span>⌘O</span></button
          >
          <button
            onclick={() => {
              fileMenu = false;
              void saveActiveTab();
            }}>Save <span>⌘S</span></button
          >
          <button
            onclick={() => {
              fileMenu = false;
              if (activeTab) void saveTabAs(activeTab.id);
            }}>Save As… <span>⇧⌘S</span></button
          >
          {#if $recentProjectsStore.length}
            <div class="menu-separator"></div>
            <span class="file-menu-label">Open Recent</span>
            {#each $recentProjectsStore.slice(0, 5) as project (project.path)}
              <button
                title={project.path}
                onclick={() => {
                  fileMenu = false;
                  void openDocumentTab(project.path);
                }}>{project.title}</button
              >
            {/each}
          {/if}
          <div class="menu-separator"></div>
          <button disabled title="Export · Phase 7"
            >Export… <span>Phase 7</span></button
          >
        </div>
      {/if}
    </div>
    <button
      class="save-command"
      disabled={!activeTab || activeTab.saveState === 'saving'}
      title="Save"
      aria-label="Save"
      onclick={() => void saveActiveTab()}
    >
      <Save size={17} />
    </button>
  </div>

  <div class="header-actions">
    <button class="header-action" disabled title="Phase 7"
      ><Play size={15} /> Present</button
    >
    <button class="header-action" disabled title="Future phase"
      ><Share2 size={15} /> Share</button
    >
  </div>
</header>
