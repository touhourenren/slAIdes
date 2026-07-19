<script lang="ts">
  import { ChevronUp } from 'lucide-svelte';
  import { activeSlide, patchSlideNotes } from '../stores/editor';
  const limit = 500;
</script>

<section class="notes-section">
  <header><span>Slide notes</span><ChevronUp /></header>
  <textarea
    aria-label="Slide notes"
    maxlength={limit}
    value={$activeSlide?.notes?.text ?? ''}
    oninput={(event) => patchSlideNotes(event.currentTarget.value)}
    placeholder="Add context, talking points, or reminders…"
  ></textarea>
  <div class="character-count">
    {($activeSlide?.notes?.text ?? '').length} / {limit}
  </div>
</section>
