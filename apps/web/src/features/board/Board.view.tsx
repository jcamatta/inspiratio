import { Settings } from '../settings/Settings.controller.tsx'
import type { GenerationKind, Item } from '@inspiratio/shared'
import {
  Background,
  BackgroundVariant,
  MiniMap,
  NodeToolbar,
  Position,
  ReactFlow,
  type NodeChange,
  type OnSelectionChangeParams,
} from '@xyflow/react'
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Expand,
  Film,
  Group,
  ImagePlus,
  Info,
  Link2,
  ListChecks,
  LogOut,
  Maximize,
  Pencil,
  Redo2,
  SquareDashed,
  Tag,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type { DragEvent, MouseEvent } from 'react'
import { cx } from '../../shared/lib/cx.ts'
import {
  Box,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuRoot,
  ContextMenuSeparator,
  ContextMenuTrigger,
  IconButton,
  Panel,
  Separator,
  Stack,
  Text,
} from '../../shared/ui/index.ts'
import { Details } from '../details/Details.controller.tsx'
import { Viewer } from '../viewer/Viewer.controller.tsx'
import type { ContextTarget } from './domain/context-target.ts'
import type { BoardNode } from './domain/flow-mapping.ts'
import { MediaNode } from './nodes/MediaNode.controller.tsx'
import { PromptNode } from './nodes/PromptNode.controller.tsx'
import { SectionNode } from './nodes/SectionNode.controller.tsx'
import { UrlImportDialog } from './UrlImportDialog.controller.tsx'

const NODE_TYPES = { media: MediaNode, section: SectionNode, prompt: PromptNode }
const PAN_BUTTONS = [1]
const DELETE_KEYS = ['Delete', 'Backspace']
const MULTI_SELECT_KEYS = ['Shift', 'Control', 'Meta']

export type BoardMenu = {
  readonly target: ContextTarget
  readonly targetCount: number
  readonly targetInSection: boolean
  readonly onGenerate: (kind: GenerationKind) => void
  readonly onRename: () => void
  readonly onAddTags: () => void
  readonly onView: () => void
  readonly onDetails: () => void
  readonly onBringToFront: () => void
  readonly onSendToBack: () => void
  readonly onDetach: () => void
  readonly onDelete: () => void
  readonly onNewPrompt: (kind: GenerationKind) => void
  readonly onCreateSection: () => void
  readonly onAddSection: () => void
  readonly onImportUrl: () => void
  readonly onFitView: () => void
  readonly onSelectAll: () => void
}

type BottomBarProps = {
  readonly zoom: number
  readonly selectionCount: number
  readonly canUndo: boolean
  readonly canRedo: boolean
  readonly onUndo: () => void
  readonly onRedo: () => void
  readonly onZoomIn: () => void
  readonly onZoomOut: () => void
  readonly onFitView: () => void
}

export type SelectionToolbar = {
  readonly ids: readonly string[]
  readonly onGenerate: (kind: GenerationKind) => void
  readonly onCreateSection: () => void
  readonly onView: () => void
  readonly onDetails: () => void
  readonly onDelete: () => void
}

export type BoardViewProps = BottomBarProps & {
  readonly toolbar: SelectionToolbar
  readonly onWrapperElement: (element: HTMLDivElement | null) => void
  readonly nodes: BoardNode[]
  readonly isEmpty: boolean
  readonly fileDropActive: boolean
  readonly onNodesChange: (changes: NodeChange<BoardNode>[]) => void
  readonly onSelectionChange: (selection: OnSelectionChangeParams<BoardNode>) => void
  readonly onDelete: (deleted: { readonly nodes: readonly BoardNode[] }) => void
  readonly onDrop: (event: DragEvent) => void
  readonly onDragOver: (event: DragEvent) => void
  readonly onDragLeave: () => void
  readonly onContextMenu: (event: MouseEvent) => void
  readonly menu: BoardMenu
  readonly viewerItem: Item | null
  readonly onCloseViewer: () => void
  readonly detailsItem: Item | null
  readonly onCloseDetails: () => void
  readonly urlDialogOpen: boolean
  readonly onUrlDialogOpenChange: (open: boolean) => void
  readonly onImportUrl: (url: string) => void
}

const BoardMenuContent = ({ menu }: { readonly menu: BoardMenu }) => {
  if (menu.target.kind === 'item') {
    const count = menu.targetCount > 1 ? ` (${String(menu.targetCount)})` : ''
    return (
      <ContextMenuContent testId="context-menu">
        <ContextMenuItem
          label={`Generate image${count}`}
          icon={ImagePlus}
          onSelect={() => menu.onGenerate('image')}
          testId="menu-generate-image"
        />
        <ContextMenuItem
          label={`Generate video${count}`}
          icon={Film}
          onSelect={() => menu.onGenerate('video')}
          testId="menu-generate-video"
        />
        <ContextMenuSeparator />
        <ContextMenuItem
          label="Rename"
          icon={Pencil}
          hint="Double-click"
          onSelect={menu.onRename}
          testId="menu-rename"
        />
        <ContextMenuItem label="Add tags" icon={Tag} onSelect={menu.onAddTags} testId="menu-tags" />
        <ContextMenuItem
          label="View full size"
          icon={Expand}
          onSelect={menu.onView}
          testId="menu-view"
        />
        <ContextMenuItem
          label="Details"
          icon={Info}
          onSelect={menu.onDetails}
          testId="menu-details"
        />
        <ContextMenuSeparator />
        <ContextMenuItem
          label="Bring to front"
          icon={ArrowUpToLine}
          onSelect={menu.onBringToFront}
          testId="menu-front"
        />
        <ContextMenuItem
          label="Send to back"
          icon={ArrowDownToLine}
          onSelect={menu.onSendToBack}
          testId="menu-back"
        />
        <ContextMenuItem
          label="Create section"
          icon={Group}
          onSelect={menu.onCreateSection}
          testId="menu-create-section"
        />
        {menu.targetInSection && (
          <ContextMenuItem
            label="Remove from section"
            icon={LogOut}
            onSelect={menu.onDetach}
            testId="menu-detach"
          />
        )}
        <ContextMenuSeparator />
        <ContextMenuItem
          label={`Delete${count}`}
          icon={Trash2}
          tone="danger"
          hint="Del"
          onSelect={menu.onDelete}
          testId="menu-delete"
        />
      </ContextMenuContent>
    )
  }
  if (menu.target.kind === 'section') {
    return (
      <ContextMenuContent testId="context-menu">
        <ContextMenuItem
          label="Rename section"
          icon={Pencil}
          onSelect={menu.onRename}
          testId="menu-rename-section"
        />
        <ContextMenuItem
          label="Delete section"
          icon={Trash2}
          tone="danger"
          onSelect={menu.onDelete}
          testId="menu-delete-section"
        />
      </ContextMenuContent>
    )
  }
  if (menu.target.kind === 'prompt') {
    return (
      <ContextMenuContent testId="context-menu">
        <ContextMenuItem
          label="Delete prompt"
          icon={Trash2}
          tone="danger"
          onSelect={menu.onDelete}
          testId="menu-delete-prompt"
        />
      </ContextMenuContent>
    )
  }
  return (
    <ContextMenuContent testId="context-menu">
      <ContextMenuItem
        label="New image prompt"
        icon={ImagePlus}
        onSelect={() => menu.onNewPrompt('image')}
        testId="menu-new-image-prompt"
      />
      <ContextMenuItem
        label="New video prompt"
        icon={Film}
        onSelect={() => menu.onNewPrompt('video')}
        testId="menu-new-video-prompt"
      />
      <ContextMenuItem
        label="Add section"
        icon={SquareDashed}
        onSelect={menu.onAddSection}
        testId="menu-add-section"
      />
      <ContextMenuItem
        label="Import from URL…"
        icon={Link2}
        onSelect={menu.onImportUrl}
        testId="menu-import-url"
      />
      <ContextMenuSeparator />
      <ContextMenuItem
        label="Select all images"
        icon={ListChecks}
        onSelect={menu.onSelectAll}
        testId="menu-select-all"
      />
      <ContextMenuItem
        label="Fit to screen"
        icon={Maximize}
        onSelect={menu.onFitView}
        testId="menu-fit"
      />
    </ContextMenuContent>
  )
}

const SelectionToolbarView = ({ toolbar }: { readonly toolbar: SelectionToolbar }) => {
  const single = toolbar.ids.length === 1
  return (
    <NodeToolbar
      nodeId={[...toolbar.ids]}
      isVisible={toolbar.ids.length > 0}
      position={Position.Top}
      offset={12}
    >
      <Panel className="flex items-center gap-0.5 p-1" testId="selection-toolbar">
        <IconButton
          icon={ImagePlus}
          label="Generate image"
          size="sm"
          onClick={() => toolbar.onGenerate('image')}
          testId="toolbar-generate-image"
        />
        <IconButton
          icon={Film}
          label="Generate video"
          size="sm"
          onClick={() => toolbar.onGenerate('video')}
          testId="toolbar-generate-video"
        />
        <IconButton
          icon={Group}
          label="Create section"
          size="sm"
          onClick={toolbar.onCreateSection}
          testId="toolbar-create-section"
        />
        {single && (
          <>
            <Separator orientation="vertical" />
            <IconButton
              icon={Expand}
              label="View full size"
              size="sm"
              onClick={toolbar.onView}
              testId="toolbar-view"
            />
            <IconButton
              icon={Info}
              label="Details"
              size="sm"
              onClick={toolbar.onDetails}
              testId="toolbar-details"
            />
          </>
        )}
        <Separator orientation="vertical" />
        <IconButton
          icon={Trash2}
          label="Delete"
          size="sm"
          onClick={toolbar.onDelete}
          testId="toolbar-delete"
        />
      </Panel>
    </NodeToolbar>
  )
}

const BottomBar = (props: BottomBarProps) => (
  <Panel
    className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 p-1"
    testId="bottom-bar"
  >
    <IconButton
      icon={Undo2}
      label="Undo (Ctrl+Z)"
      disabled={!props.canUndo}
      onClick={props.onUndo}
      testId="undo"
    />
    <IconButton
      icon={Redo2}
      label="Redo (Ctrl+Shift+Z)"
      disabled={!props.canRedo}
      onClick={props.onRedo}
      testId="redo"
    />
    <Separator orientation="vertical" />
    <IconButton icon={ZoomOut} label="Zoom out" onClick={props.onZoomOut} testId="zoom-out" />
    <Text variant="mono" className="w-11 text-center" testId="zoom-level">
      {Math.round(props.zoom * 100)}%
    </Text>
    <IconButton icon={ZoomIn} label="Zoom in" onClick={props.onZoomIn} testId="zoom-in" />
    <IconButton icon={Maximize} label="Fit to screen" onClick={props.onFitView} testId="fit" />
    <Separator orientation="vertical" />
    <Settings />
    {props.selectionCount > 0 && (
      <>
        <Separator orientation="vertical" />
        <Text variant="label" className="px-2 text-mint-700" testId="selection-count">
          {props.selectionCount} selected
        </Text>
      </>
    )}
  </Panel>
)

export const BoardView = ({ onWrapperElement, ...props }: BoardViewProps) => (
  <ContextMenuRoot>
    <ContextMenuTrigger className="relative size-full" onContextMenu={props.onContextMenu}>
      <Box
        ref={onWrapperElement}
        testId="board"
        className={cx(
          'absolute inset-0',
          props.fileDropActive && 'ring-4 ring-primary/60 ring-inset',
        )}
        onDrop={props.onDrop}
        onDragOver={props.onDragOver}
        onDragLeave={props.onDragLeave}
      >
        <ReactFlow<BoardNode>
          nodes={props.nodes}
          edges={[]}
          nodeTypes={NODE_TYPES}
          onNodesChange={props.onNodesChange}
          onSelectionChange={props.onSelectionChange}
          onDelete={props.onDelete}
          selectionOnDrag
          panOnDrag={PAN_BUTTONS}
          deleteKeyCode={DELETE_KEYS}
          multiSelectionKeyCode={MULTI_SELECT_KEYS}
          minZoom={0.05}
          maxZoom={8}
          zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: true }}
          fitView
          fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} />
          <SelectionToolbarView toolbar={props.toolbar} />
          <MiniMap
            pannable
            zoomable
            position="bottom-left"
            className="!rounded-xl !border !border-border !shadow-(--shadow-panel)"
          />
        </ReactFlow>
        {props.isEmpty && (
          <Stack
            align="center"
            justify="center"
            className="pointer-events-none absolute inset-0"
            testId="empty-state"
          >
            <Text variant="title" className="text-muted-foreground">
              Drop images or videos
            </Text>
          </Stack>
        )}
        <BottomBar {...props} />
      </Box>
    </ContextMenuTrigger>
    <BoardMenuContent menu={props.menu} />
    <Viewer item={props.viewerItem} onClose={props.onCloseViewer} />
    <Details item={props.detailsItem} onClose={props.onCloseDetails} />
    <UrlImportDialog
      open={props.urlDialogOpen}
      onOpenChange={props.onUrlDialogOpenChange}
      onSubmit={props.onImportUrl}
    />
  </ContextMenuRoot>
)
