<script lang="ts">
  import {
    ChevronUp,
    FileText,
    LayoutTemplate,
    MessageSquareText,
    Sparkles,
    Target,
    WandSparkles
  } from 'lucide-svelte';
  import SlideNotesPanel from './SlideNotesPanel.svelte';
</script>

<div class="ai-panel">
  <section class="ai-assistant">
    <header><span><Sparkles /> AI Assistant</span><ChevronUp /></header>
    <div class="welcome-card">
      <strong>Hi there! <span>👋</span></strong>
      <p>How can I help with your presentation today?</p>
    </div>
    <div class="ai-actions">
      <button disabled><WandSparkles />Generate slide from prompt</button>
      <button disabled><FileText />Summarize this slide</button>
      <button disabled><Target />Improve content</button>
      <button disabled><LayoutTemplate />Suggest layout</button>
      <button disabled><MessageSquareText />More prompts</button>
    </div>
    <p class="ai-offline"><span></span> AI provider not connected · Phase 8</p>
  </section>
  <SlideNotesPanel />
</div>
