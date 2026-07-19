<script lang="ts">
  import { FilePlus2, FolderOpen } from 'lucide-svelte';
  import { newDocumentTab, openDocument } from '../stores/workspace';
</script>

<section class="empty-workspace">
  <div class="empty-workspace-icon"><FilePlus2 size={27} /></div>
  <h1>Create a file to get started</h1>
  <p>Start a new presentation or open an existing SlAIdes project.</p>
  <div class="empty-workspace-actions">
    <button class="primary" onclick={newDocumentTab}
      ><FilePlus2 size={16} /> New presentation</button
    >
    <button onclick={() => void openDocument()}
      ><FolderOpen size={16} /> Open file…</button
    >
  </div>
</section>
