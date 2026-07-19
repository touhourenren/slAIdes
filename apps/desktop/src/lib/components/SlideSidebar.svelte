<script lang="ts">
  import { MoreHorizontal, Plus } from 'lucide-svelte';
  import {
    addNewSlide,
    deleteActiveSlide,
    documentStore,
    duplicateActiveSlide
  } from '../stores/editor';
  import SlidesPanel from './SlidesPanel.svelte';
  let menu = false;
</script>

<aside class="slide-sidebar" aria-label="Slides">
  <div class="sidebar-heading">
    <span>Slides</span>
    <div class="sidebar-actions">
      <button title="Add slide" onclick={addNewSlide}><Plus /></button><button
        title="More slide actions"
        onclick={() => (menu = !menu)}><MoreHorizontal /></button
      >
      {#if menu}<div class="slide-menu">
          <button
            onclick={() => {
              duplicateActiveSlide();
              menu = false;
            }}>Duplicate slide</button
          ><button
            disabled={$documentStore.slides.length <= 1}
            onclick={() => {
              deleteActiveSlide();
              menu = false;
            }}>Delete slide</button
          >
        </div>{/if}
    </div>
  </div>
  <SlidesPanel />
  <button class="add-slide" onclick={addNewSlide}><Plus /> Add slide</button>
</aside>
