<script lang="ts">
  import {
    CURRENT_SCHEMA_VERSION,
    DEFAULT_SLIDE_SIZE,
    createSampleDocument,
    parseSlideDocument
  } from '@slaides/slide-schema';

  const sampleDocument = parseSlideDocument(createSampleDocument());
  const phases = [
    {
      label: 'Phase 1',
      title: 'Project Foundation',
      detail: 'Tauri 2 + SvelteKit',
      ready: true
    },
    {
      label: 'Phase 2',
      title: 'Domain Model',
      detail: `Schema v${CURRENT_SCHEMA_VERSION}`,
      ready: true
    },
    {
      label: 'Phase 3',
      title: 'Canvas Editor',
      detail: 'Not installed',
      ready: false
    }
  ];
</script>

<svelte:head>
  <title>SlAIdes</title>
  <meta
    name="description"
    content="SlAIdes desktop foundation and canonical slide document model"
  />
</svelte:head>

<main
  class="min-h-screen bg-[radial-gradient(circle_at_top_left,#202d55_0,#0b1020_35%,#080b12_70%)] p-6 sm:p-10"
>
  <div
    class="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950/65 shadow-2xl shadow-black/40 backdrop-blur"
  >
    <header
      class="flex items-center justify-between border-b border-white/10 px-6 py-5 sm:px-8"
    >
      <div class="flex items-center gap-3">
        <div
          class="grid size-10 place-items-center rounded-xl bg-indigo-500 font-bold text-white"
        >
          S
        </div>
        <div>
          <h1 class="text-lg font-semibold tracking-tight text-white">
            SlAIdes
          </h1>
          <p class="text-xs text-slate-400">System foundation MVP</p>
        </div>
      </div>
      <span
        class="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300"
      >
        Domain validated
      </span>
    </header>

    <section
      class="grid flex-1 gap-8 p-6 sm:p-8 lg:grid-cols-[1.4fr_1fr] lg:p-12"
    >
      <div class="flex flex-col justify-center">
        <p
          class="mb-4 text-sm font-medium uppercase tracking-[0.22em] text-indigo-300"
        >
          Build with confidence
        </p>
        <h2
          class="max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-white sm:text-6xl"
        >
          The foundation for intelligent slide creation.
        </h2>
        <p class="mt-6 max-w-xl text-base leading-7 text-slate-300">
          The desktop shell is running against the canonical SlideDocument
          model. Rendering, persistence, export, and AI adapters remain
          intentionally outside this phase.
        </p>

        <dl class="mt-10 grid max-w-xl grid-cols-3 gap-3">
          <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
            <dt class="text-xs text-slate-400">Canvas</dt>
            <dd class="mt-1 font-mono text-sm text-white">
              {DEFAULT_SLIDE_SIZE.width} × {DEFAULT_SLIDE_SIZE.height}
            </dd>
          </div>
          <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
            <dt class="text-xs text-slate-400">Slides</dt>
            <dd class="mt-1 text-lg font-semibold text-white">
              {sampleDocument.slides.length}
            </dd>
          </div>
          <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
            <dt class="text-xs text-slate-400">Elements</dt>
            <dd class="mt-1 text-lg font-semibold text-white">
              {sampleDocument.slides[0]?.elements.length ?? 0}
            </dd>
          </div>
        </dl>
      </div>

      <aside
        class="flex flex-col justify-center rounded-3xl border border-white/10 bg-slate-900/70 p-5 sm:p-7"
      >
        <p class="mb-5 text-sm font-medium text-slate-300">
          Implementation status
        </p>
        <ol class="space-y-3">
          {#each phases as phase (phase.label)}
            <li
              class="flex items-center gap-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4"
            >
              <span
                class:opacity-30={!phase.ready}
                class="grid size-9 place-items-center rounded-full bg-indigo-500/20 text-indigo-300"
              >
                {phase.ready ? '✓' : '–'}
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-xs text-slate-500">{phase.label}</p>
                <p class="font-medium text-white">{phase.title}</p>
              </div>
              <span class="text-right text-xs text-slate-400"
                >{phase.detail}</span
              >
            </li>
          {/each}
        </ol>
      </aside>
    </section>
  </div>
</main>
