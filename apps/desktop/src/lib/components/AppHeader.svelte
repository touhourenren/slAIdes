<script lang="ts">
  import { ChevronDown, Cloud, File, Play, Save, Share2 } from 'lucide-svelte';
  let fileMenu = false;
</script>

<header class="app-header">
  <div class="header-document">
    <span class="wordmark">Sl<span>AI</span>des</span>
    <span class="header-divider"></span>
    <button class="deck-title"
      >Untitled presentation <ChevronDown size={14} /></button
    >
    <span class="save-state"><Cloud size={15} /> Session</span>
  </div>

  <nav class="document-tools" aria-label="Document commands">
    <div class="file-popover">
      <button
        class="file-trigger"
        aria-expanded={fileMenu}
        onclick={() => (fileMenu = !fileMenu)}
        ><File size={16} /> File <ChevronDown size={13} /></button
      >
      {#if fileMenu}
        <div class="file-menu">
          <button disabled title="Local save · Phase 5"
            >New <span>Phase 5</span></button
          >
          <button disabled title="Local save · Phase 5"
            >Open… <span>Phase 5</span></button
          >
          <button disabled title="Local save · Phase 5"
            >Save As… <span>Phase 5</span></button
          >
          <div class="menu-separator"></div>
          <button disabled title="Export · Phase 7"
            >Export… <span>Phase 7</span></button
          >
        </div>
      {/if}
    </div>
    <button
      class="save-command"
      disabled
      title="Local save · Phase 5"
      aria-label="Save"
    >
      <Save size={17} />
    </button>
  </nav>

  <div class="header-actions">
    <button class="action-pill" disabled title="Phase 7"
      ><Play size={15} /> Present <ChevronDown size={13} /></button
    >
    <button class="action-pill" disabled title="Future phase"
      ><Share2 size={15} /> Share</button
    >
    <button class="avatar" aria-label="User menu">S</button>
    <ChevronDown class="user-chevron" size={14} />
  </div>
</header>
