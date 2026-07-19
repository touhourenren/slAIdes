<script lang="ts">
  import type { ShapeElement, SlideElement } from '@slaides/slide-schema';
  import { clampCornerRadius } from '@slaides/editor-core';
  import { ChevronUp } from 'lucide-svelte';
  import { patchElement, selectedElements } from '../stores/editor';

  $: element =
    $selectedElements.length === 1 ? $selectedElements[0] : undefined;

  function update(changes: Partial<SlideElement>) {
    if (element) patchElement(element.id, changes);
  }
  function number(key: string, value: string) {
    const parsed = Number(value);
    if (Number.isFinite(parsed))
      update({ [key]: parsed } as Partial<SlideElement>);
  }
  function changeShapeType(shapeType: ShapeElement['shapeType']) {
    if (!element || element.type !== 'shape') return;
    update({
      shapeType,
      cornerRadius:
        shapeType === 'rounded-rectangle'
          ? element.cornerRadius || 220
          : undefined
    } as Partial<SlideElement>);
  }
  function changeRadius(raw: string) {
    if (!element || element.type !== 'shape') return;
    const cornerRadius = clampCornerRadius(
      element.width,
      element.height,
      Number(raw)
    );
    update({
      shapeType: cornerRadius > 0 ? 'rounded-rectangle' : 'rectangle',
      cornerRadius: cornerRadius > 0 ? cornerRadius : undefined
    } as Partial<SlideElement>);
  }
</script>

<div class="panel-body properties-panel">
  <div class="panel-title">
    <span>Properties</span>{#if element}<small>{element.type}</small>{/if}
  </div>
  {#if !element}
    <div class="empty-state">
      {$selectedElements.length > 1
        ? `${$selectedElements.length} objects selected`
        : 'Select an object to edit its properties.'}
    </div>
  {:else}
    <section class="property-section">
      <header><span>Transform</span><ChevronUp /></header>
      <div class="property-grid transform-grid">
        {#each [['x', 'X'], ['y', 'Y'], ['width', 'W'], ['height', 'H']] as field (field[0])}
          <label
            ><span>{field[1]}</span><input
              type="number"
              value={String(element[field[0] as keyof SlideElement] ?? 0)}
              oninput={(event) => number(field[0], event.currentTarget.value)}
            /></label
          >
        {/each}
        <label
          ><span>°</span><input
            type="number"
            value={element.rotation}
            oninput={(event) => number('rotation', event.currentTarget.value)}
          /></label
        >
        <label
          ><span>%</span><input
            type="number"
            min="0"
            max="100"
            value={Math.round(element.opacity * 100)}
            oninput={(event) =>
              number(
                'opacity',
                String(Number(event.currentTarget.value) / 100)
              )}
          /></label
        >
      </div>
      <div class="toggle-row">
        <label
          ><input
            type="checkbox"
            checked={!element.hidden}
            onchange={(event) =>
              update({ hidden: !event.currentTarget.checked })}
          /> Visible</label
        ><label
          ><input
            type="checkbox"
            checked={element.locked}
            onchange={(event) =>
              update({ locked: event.currentTarget.checked })}
          /> Locked</label
        >
      </div>
    </section>

    {#if element.type === 'text'}
      <section class="property-section">
        <header><span>Text</span><ChevronUp /></header>
        <textarea
          class="text-content"
          aria-label="Text content"
          value={element.text}
          oninput={(event) =>
            update({
              text: event.currentTarget.value
            } as Partial<SlideElement>)}
        ></textarea>
        <div class="property-grid">
          <label class="span-two"
            ><span>Font</span><select
              value={element.fontFamily}
              onchange={(event) =>
                update({
                  fontFamily: event.currentTarget.value
                } as Partial<SlideElement>)}
              ><option value="system-ui">SF Pro (System)</option><option
                value="ui-serif">New York (System)</option
              ><option value="ui-monospace">SF Mono (System)</option><option
                value="Inter Variable">Inter</option
              ><option value="Noto Sans JP Variable">Noto Sans JP</option
              ></select
            ></label
          >
          <label
            ><span>Size</span><input
              type="number"
              min="1"
              value={element.fontSize}
              oninput={(event) => number('fontSize', event.currentTarget.value)}
            /></label
          >
          <label
            ><span>Weight</span><select
              value={String(element.fontWeight)}
              onchange={(event) =>
                number('fontWeight', event.currentTarget.value)}
              ><option value="400">Regular</option><option value="500"
                >Medium</option
              ><option value="600">Semibold</option><option value="700"
                >Bold</option
              ></select
            ></label
          >
          <label
            ><span>Style</span><select
              value={element.fontStyle}
              onchange={(event) =>
                update({
                  fontStyle: event.currentTarget.value as 'normal' | 'italic'
                } as Partial<SlideElement>)}
              ><option value="normal">Normal</option><option value="italic"
                >Italic</option
              ></select
            ></label
          >
          <label
            ><span>Color</span>
            <div class="color-control">
              <input
                type="color"
                value={element.color}
                aria-label="Text color"
                oninput={(event) =>
                  update({
                    color: event.currentTarget.value
                  } as Partial<SlideElement>)}
              /><code>{element.color.toUpperCase()}</code>
            </div></label
          >
          <label
            ><span>Align</span><select
              value={element.horizontalAlign}
              onchange={(event) =>
                update({
                  horizontalAlign: event.currentTarget
                    .value as typeof element.horizontalAlign
                } as Partial<SlideElement>)}
              ><option value="left">Left</option><option value="center"
                >Center</option
              ><option value="right">Right</option><option value="justify"
                >Justify</option
              ></select
            ></label
          >
          <label
            ><span>Vertical</span><select
              value={element.verticalAlign}
              onchange={(event) =>
                update({
                  verticalAlign: event.currentTarget
                    .value as typeof element.verticalAlign
                } as Partial<SlideElement>)}
              ><option value="top">Top</option><option value="middle"
                >Middle</option
              ><option value="bottom">Bottom</option></select
            ></label
          >
        </div>
      </section>
    {:else if element.type === 'shape'}
      <section class="property-section">
        <header><span>Appearance</span><ChevronUp /></header>
        <div class="property-grid">
          <label class="span-two"
            ><span>Shape</span><select
              value={element.shapeType}
              onchange={(event) =>
                changeShapeType(
                  event.currentTarget.value as ShapeElement['shapeType']
                )}
              ><option value="rectangle">Rectangle</option><option
                value="rounded-rectangle">Rounded rectangle</option
              ><option value="ellipse">Ellipse</option><option value="triangle"
                >Triangle</option
              ></select
            ></label
          >
          <label
            ><span>Fill</span>
            <div class="color-control">
              <input
                type="color"
                value={element.fill}
                aria-label="Shape fill"
                oninput={(event) =>
                  update({
                    fill: event.currentTarget.value
                  } as Partial<SlideElement>)}
              /><code>{element.fill.toUpperCase()}</code>
            </div></label
          >
          <label
            ><span>Stroke</span>
            <div class="color-control">
              <input
                type="color"
                value={element.stroke}
                aria-label="Shape stroke"
                oninput={(event) =>
                  update({
                    stroke: event.currentTarget.value
                  } as Partial<SlideElement>)}
              /><code>{element.stroke.toUpperCase()}</code>
            </div></label
          >
          <label
            ><span>Width</span><input
              type="number"
              min="0"
              value={element.strokeWidth}
              oninput={(event) =>
                number('strokeWidth', event.currentTarget.value)}
            /></label
          >
          {#if element.shapeType === 'rectangle' || element.shapeType === 'rounded-rectangle'}
            <label
              ><span>Radius</span><input
                type="number"
                min="0"
                max={Math.min(element.width, element.height) / 2}
                value={element.cornerRadius ?? 0}
                oninput={(event) => changeRadius(event.currentTarget.value)}
              /></label
            >
            <label class="span-two range-label"
              ><span>Corner</span><input
                type="range"
                min="0"
                max={Math.min(element.width, element.height) / 2}
                step="10"
                value={element.cornerRadius ?? 0}
                oninput={(event) => changeRadius(event.currentTarget.value)}
              /></label
            >
          {/if}
        </div>
      </section>
    {:else if element.type === 'line'}
      <section class="property-section">
        <header><span>Line</span><ChevronUp /></header>
        <div class="property-grid">
          <label
            ><span>Color</span>
            <div class="color-control">
              <input
                type="color"
                value={element.stroke}
                aria-label="Line color"
                oninput={(event) =>
                  update({
                    stroke: event.currentTarget.value
                  } as Partial<SlideElement>)}
              /><code>{element.stroke.toUpperCase()}</code>
            </div></label
          ><label
            ><span>Width</span><input
              type="number"
              min="0"
              value={element.strokeWidth}
              oninput={(event) =>
                number('strokeWidth', event.currentTarget.value)}
            /></label
          >
        </div>
      </section>
    {:else if element.type === 'image'}
      <section class="property-section">
        <header><span>Image</span><ChevronUp /></header>
        <label class="single-control"
          ><span>Fit</span><select
            value={element.fit}
            onchange={(event) =>
              update({
                fit: event.currentTarget.value as typeof element.fit
              } as Partial<SlideElement>)}
            ><option value="contain">Contain</option><option value="cover"
              >Cover</option
            ><option value="fill">Fill</option></select
          ></label
        >
        <p class="session-message">Session asset · not saved</p>
      </section>
    {/if}
  {/if}
</div>
