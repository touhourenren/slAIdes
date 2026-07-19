<script lang="ts">
  import type {
    AssetReference,
    Slide,
    SlideSize,
    TextElement,
    TextStyleAttributes
  } from '@slaides/slide-schema';
  import { splitTextGraphemes } from '@slaides/slide-schema';
  import { resolveAssetUrl } from '../stores/editor';

  export let slide: Slide;
  export let size: SlideSize;
  export let assets: AssetReference[];

  const imageUrl = (assetId: string) => {
    const asset = assets.find((item) => item.id === assetId);
    return asset ? resolveAssetUrl(asset) : undefined;
  };
  const objectFit = (fit: 'contain' | 'cover' | 'fill') =>
    fit === 'contain'
      ? 'xMidYMid meet'
      : fit === 'cover'
        ? 'xMidYMid slice'
        : 'none';

  function textSegments(element: TextElement) {
    const graphemes = splitTextGraphemes(element.text);
    const segments: Array<{
      text: string;
      style: Required<TextStyleAttributes>;
    }> = [];
    for (let index = 0; index < graphemes.length; index++) {
      const range = element.textStyles?.find(
        (style) => style.start <= index && style.end > index
      );
      const style = {
        fontFamily: range?.fontFamily ?? element.fontFamily,
        fontSize: range?.fontSize ?? element.fontSize,
        fontWeight: range?.fontWeight ?? element.fontWeight,
        fontStyle: range?.fontStyle ?? element.fontStyle,
        color: range?.color ?? element.color
      };
      const previous = segments.at(-1);
      if (previous && JSON.stringify(previous.style) === JSON.stringify(style))
        previous.text += graphemes[index];
      else segments.push({ text: graphemes[index], style });
    }
    return segments;
  }
</script>

<svg
  class="slide-thumbnail-svg"
  viewBox={`0 0 ${size.width} ${size.height}`}
  preserveAspectRatio="xMidYMid meet"
  aria-hidden="true"
>
  <rect width={size.width} height={size.height} fill={slide.background.color} />
  {#each [...slide.elements].sort((a, b) => a.zIndex - b.zIndex) as element (element.id)}
    {#if !element.hidden}
      <g
        opacity={element.opacity}
        transform={`rotate(${element.rotation} ${element.x} ${element.y})`}
      >
        {#if element.type === 'text'}
          <foreignObject
            x={element.x}
            y={element.y}
            width={element.width}
            height={element.height}
          >
            <div
              class="thumbnail-text"
              style:font-family={element.fontFamily}
              style:font-size={`${element.fontSize}px`}
              style:font-weight={element.fontWeight}
              style:font-style={element.fontStyle}
              style:color={element.color}
              style:text-align={element.horizontalAlign}
              style:justify-content={element.horizontalAlign === 'left'
                ? 'flex-start'
                : element.horizontalAlign === 'right'
                  ? 'flex-end'
                  : 'center'}
              style:line-height={element.lineHeight}
              style:align-items={element.verticalAlign === 'top'
                ? 'flex-start'
                : element.verticalAlign === 'bottom'
                  ? 'flex-end'
                  : 'center'}
            >
              <div class="thumbnail-text-content">
                {#each textSegments(element) as segment, segmentIndex (segmentIndex)}
                  <span
                    style:font-family={segment.style.fontFamily}
                    style:font-size={`${segment.style.fontSize}px`}
                    style:font-weight={segment.style.fontWeight}
                    style:font-style={segment.style.fontStyle}
                    style:color={segment.style.color}>{segment.text}</span
                  >
                {/each}
              </div>
            </div>
          </foreignObject>
        {:else if element.type === 'shape'}
          {#if element.shapeType === 'ellipse'}
            <ellipse
              cx={element.x + element.width / 2}
              cy={element.y + element.height / 2}
              rx={element.width / 2}
              ry={element.height / 2}
              fill={element.fill}
              stroke={element.stroke}
              stroke-width={element.strokeWidth}
            />
          {:else if element.shapeType === 'triangle'}
            <polygon
              points={`${element.x + element.width / 2},${element.y} ${element.x + element.width},${element.y + element.height} ${element.x},${element.y + element.height}`}
              fill={element.fill}
              stroke={element.stroke}
              stroke-width={element.strokeWidth}
            />
          {:else}
            <rect
              x={element.x}
              y={element.y}
              width={element.width}
              height={element.height}
              rx={element.cornerRadius ?? 0}
              ry={element.cornerRadius ?? 0}
              fill={element.fill}
              stroke={element.stroke}
              stroke-width={element.strokeWidth}
            />
          {/if}
        {:else if element.type === 'line'}
          <line
            x1={element.x}
            y1={element.y}
            x2={element.x2}
            y2={element.y2}
            stroke={element.stroke}
            stroke-width={element.strokeWidth}
          />
        {:else if element.type === 'image'}
          {@const source = imageUrl(element.assetId)}
          {#if source}<image
              href={source}
              x={element.x}
              y={element.y}
              width={element.width}
              height={element.height}
              preserveAspectRatio={objectFit(element.fit)}
            />{:else}<rect
              x={element.x}
              y={element.y}
              width={element.width}
              height={element.height}
              fill="#e5e7eb"
              stroke="#94a3b8"
              stroke-dasharray="80 50"
            />{/if}
        {/if}
      </g>
    {/if}
  {/each}
</svg>

<style>
  .slide-thumbnail-svg {
    display: block;
    width: 100%;
    height: 100%;
  }
  .thumbnail-text {
    display: flex;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  .thumbnail-text-content {
    width: 100%;
    min-width: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
