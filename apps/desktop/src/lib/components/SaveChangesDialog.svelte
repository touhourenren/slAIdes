<script lang="ts">
  import { tick } from 'svelte';
  import { FileWarning } from 'lucide-svelte';
  import { closePromptStore, resolveClosePrompt } from '../stores/workspace';

  let saveButton: HTMLButtonElement;
  let focusedPromptId: string | undefined;
  $: if ($closePromptStore?.tabId !== focusedPromptId) {
    focusedPromptId = $closePromptStore?.tabId;
    if (focusedPromptId) void tick().then(() => saveButton?.focus());
  }
</script>

<svelte:window
  onkeydown={(event) => {
    if ($closePromptStore && event.key === 'Escape') {
      event.preventDefault();
      resolveClosePrompt('cancel');
    }
  }}
/>

{#if $closePromptStore}
  <div class="dialog-scrim" role="presentation">
    <div
      class="save-changes-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="save-dialog-title"
      aria-describedby="save-dialog-description"
    >
      <div class="dialog-icon"><FileWarning size={22} /></div>
      <div class="dialog-copy">
        <h2 id="save-dialog-title">
          Save changes to “{$closePromptStore.title}”?
        </h2>
        <p id="save-dialog-description">
          Your changes will be lost if you close this presentation without
          saving.
        </p>
      </div>
      <div class="dialog-actions">
        <button
          class="dialog-button"
          onclick={() => resolveClosePrompt('cancel')}>Cancel</button
        >
        <button
          class="dialog-button destructive"
          onclick={() => resolveClosePrompt('discard')}>Don’t Save</button
        >
        <button
          class="dialog-button primary"
          bind:this={saveButton}
          onclick={() => resolveClosePrompt('save')}>Save</button
        >
      </div>
    </div>
  </div>
{/if}
