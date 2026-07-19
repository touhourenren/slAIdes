<script lang="ts">
  import {
    AlignCenter,
    ChevronDown,
    Copy,
    Crop,
    Eye,
    Image as ImageIcon,
    Minus,
    MousePointer2,
    MoreHorizontal,
    PanelRightClose,
    PanelRightOpen,
    Redo2,
    RotateCw,
    Type,
    Undo2
  } from 'lucide-svelte';
  import {
    canRedoStore,
    canUndoStore,
    duplicateSelected,
    insertElement,
    redo,
    redoLabelStore,
    selectedElementIds,
    undo,
    undoLabelStore
  } from '../stores/editor';

  export let chooseImage: () => void;
  export let inspectorOpen: boolean;
  export let toggleInspector: () => void;
  let shapeMenu = false;
  let moreMenu = false;

  const addShape = (
    type: 'rectangle' | 'rounded-rectangle' | 'ellipse' | 'triangle'
  ) => {
    insertElement('shape', type);
    shapeMenu = false;
  };
</script>

<div class="main-toolbar">
  <div class="toolbar-leading">
    <div class="toolbar-group">
      <button
        disabled={!$canUndoStore}
        title={$undoLabelStore ? `Undo ${$undoLabelStore}` : 'Nothing to undo'}
        onclick={undo}><Undo2 /></button
      >
      <button
        disabled={!$canRedoStore}
        title={$redoLabelStore ? `Redo ${$redoLabelStore}` : 'Nothing to redo'}
        onclick={redo}><Redo2 /></button
      >
    </div>
  </div>
  <div class="toolbar-center">
    <div class="toolbar-group">
      <button class="active" title="Select"><MousePointer2 /></button>
      <button title="Add text" onclick={() => insertElement('text')}
        ><Type /></button
      >
      <div class="toolbar-popover shape-control">
        <button title="Add shape" onclick={() => (shapeMenu = !shapeMenu)}
          ><span class="shape-icon"></span><ChevronDown size={12} /></button
        >
        {#if shapeMenu}<div class="shape-menu">
            <button onclick={() => addShape('rectangle')}
              ><span class="shape-preview rectangle"></span>Rectangle</button
            >
            <button onclick={() => addShape('rounded-rectangle')}
              ><span class="shape-preview rounded"></span>Rounded rectangle</button
            >
            <button onclick={() => addShape('ellipse')}
              ><span class="shape-preview ellipse"></span>Ellipse</button
            >
            <button onclick={() => addShape('triangle')}
              ><span class="shape-preview triangle"></span>Triangle</button
            >
          </div>{/if}
      </div>
      <button title="Add session image" onclick={chooseImage}
        ><ImageIcon /></button
      >
      <button title="Add line" onclick={() => insertElement('line')}
        ><Minus /></button
      >
    </div>
    <div class="toolbar-group toolbar-secondary">
      <button
        disabled={!$selectedElementIds.length}
        title="Duplicate selected objects"
        onclick={duplicateSelected}><Copy /></button
      >
      <button disabled title="Rotate menu · Future phase"><RotateCw /></button>
      <button disabled title="Crop · Future phase"><Crop /></button>
      <button disabled title="Align · Future phase"><AlignCenter /></button>
    </div>
  </div>
  <div class="toolbar-tail">
    <button title="Preview" disabled><Eye /></button>
    <button
      title={inspectorOpen ? 'Hide inspector' : 'Show inspector'}
      onclick={toggleInspector}
    >
      {#if inspectorOpen}<PanelRightClose />{:else}<PanelRightOpen />{/if}
    </button>
    <div class="toolbar-popover">
      <button aria-label="More" onclick={() => (moreMenu = !moreMenu)}
        ><MoreHorizontal /></button
      >
      {#if moreMenu}<div class="more-menu">
          <button disabled>Export <span>Phase 7</span></button><button disabled
            >AI settings <span>Phase 8</span></button
          >
        </div>{/if}
    </div>
  </div>
</div>
