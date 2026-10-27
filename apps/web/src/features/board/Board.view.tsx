import { mediaUrlOf } from '@inspiratio/shared'
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  type NodeChange,
  type OnSelectionChangeParams,
} from '@xyflow/react'
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Expand,
  Film,
  Focus,
  ImagePlus,
  Link2,
  ListChecks,
  LogOut,
  Maximize,
  MessageSquarePlus,
  SquareDashed,
  Trash2,
} from 'lucide-react'
import type { DragEvent, MouseEvent } from 'react'
import { cx } from '../../shared/lib/cx.ts'
import {
  Box,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRoot,
  ContextMenuSeparator,
  ContextMenuTrigger,
  Dialog,
  Kbd,
  MediaImage,
  MediaVideo,
  Stack,
  Text,
} from '../../shared/ui/index.ts'
import type { BoardMenu } from './Board.controller.tsx'
import type { BoardNode } from './domain/flow-mapping.ts'
import { MediaNode } from './nodes/MediaNode.controller.tsx'
import { SectionNode } from './nodes/SectionNode.controller.tsx'
import { UrlImportDialog } from './UrlImportDialog.controller.tsx'
import type { Item } from '@inspiratio/shared'

const NODE_TYPES = { media: MediaNode, section: SectionNode }
const PAN_BUTTONS = [1]
const DELETE_KEYS = ['Delete', 'Backspace']

export type BoardViewProps = {
  readonly onWrapperElement: (element: HTMLDivElement | null) => void
  readonly nodes: BoardNode[]
  readonly isEmpty: boolean
  readonly dropActive: boolean
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
  readonly urlDialogOpen: boolean
  readonly onUrlDialogOpenChange: (open: boolean) => void
  readonly onImportUrl: (url: string) => void
}

const BoardMenuContent = ({ menu }: { readonly menu: BoardMenu }) => {
  if (menu.target.kind === 'item') {
    const plural = menu.targetCount > 1 ? ` (${menu.targetCount})` : ''
    return (
      <ContextMenuContent testId="context-menu">
        <ContextMenuLabel>Generate with references{plural}</ContextMenuLabel>
        <ContextMenuItem
          label="Create image…"
          icon={ImagePlus}
          onSelect={() => menu.onGenerate('image')}
          testId="menu-generate-image"
        />
        <ContextMenuItem
          label="Create video…"
          icon={Film}
          onSelect={() => menu.onGenerate('video')}
          testId="menu-generate-video"
        />
        <ContextMenuItem
          label="Add to prompt"
          icon={MessageSquarePlus}
          onSelect={menu.onAddToPrompt}
          testId="menu-add-to-prompt"
        />
        <ContextMenuSeparator />
        <ContextMenuItem
          label="View full size"
          icon={Expand}
          onSelect={menu.onView}
          hint="dbl-click"
          testId="menu-view"
        />
        <ContextMenuItem
          label="Zoom to fit"
          icon={Focus}
          onSelect={menu.onFocus}
          testId="menu-focus"
        />
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
          label={`Delete${plural}`}
          icon={Trash2}
          tone="danger"
          onSelect={menu.onDelete}
          hint="Del"
          testId="menu-delete"
        />
      </ContextMenuContent>
    )
  }
  if (menu.target.kind === 'section') {
    return (
      <ContextMenuContent testId="context-menu">
        <ContextMenuLabel>Section</ContextMenuLabel>
        <ContextMenuItem
          label="Delete section (keep items)"
          icon={Trash2}
          tone="danger"
          onSelect={menu.onDelete}
          testId="menu-delete-section"
        />
      </ContextMenuContent>
    )
  }
  return (
    <ContextMenuContent testId="context-menu">
      <ContextMenuItem
        label="Add section here"
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
        label="Select all"
        icon={ListChecks}
        onSelect={menu.onSelectAll}
        testId="menu-select-all"
      />
      <ContextMenuItem
        label="Fit everything"
        icon={Maximize}
        onSelect={menu.onFitView}
        testId="menu-fit"
      />
    </ContextMenuContent>
  )
}

const EmptyState = () => (
  <Stack
    align="center"
    justify="center"
    gap={3}
    className="pointer-events-none absolute inset-0"
    testId="empty-state"
  >
    <Box className="rounded-2xl border border-dashed border-border-strong bg-panel/70 px-8 py-6 text-center backdrop-blur">
      <Stack align="center" gap={2}>
        <Text variant="title">Drop your references here</Text>
        <Text variant="caption">
          Drag images or videos from your desktop or browser, or paste with <Kbd>Ctrl</Kbd>{' '}
          <Kbd>V</Kbd>
        </Text>
        <Text variant="caption">
          Scroll to zoom · <Kbd>Space</Kbd> + drag or middle-click to pan · right-click for actions
        </Text>
      </Stack>
    </Box>
  </Stack>
)

export const BoardView = ({ onWrapperElement, ...props }: BoardViewProps) => (
  <ContextMenuRoot>
    <ContextMenuTrigger className="relative min-w-0 flex-1" onContextMenu={props.onContextMenu}>
      <Box
        ref={onWrapperElement}
        testId="board"
        className={cx('absolute inset-0', props.dropActive && 'ring-4 ring-primary/60 ring-inset')}
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
          multiSelectionKeyCode={['Shift', 'Control', 'Meta']}
          minZoom={0.05}
          maxZoom={8}
          zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: true }}
          fitView
          fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} />
          <MiniMap
            pannable
            zoomable
            position="bottom-left"
            className="!rounded-xl !border !border-border !shadow-(--shadow-panel)"
          />
        </ReactFlow>
        {props.isEmpty && <EmptyState />}
      </Box>
    </ContextMenuTrigger>
    <BoardMenuContent menu={props.menu} />

    <Dialog
      open={props.viewerItem !== null}
      onOpenChange={(open) => {
        if (!open) props.onCloseViewer()
      }}
      title={props.viewerItem?.title ?? ''}
      size="full"
      testId="viewer"
    >
      {props.viewerItem !== null && (
        <Box className="min-h-0 flex-1 overflow-hidden rounded-lg bg-mint-950">
          {props.viewerItem.kind === 'video' ? (
            <MediaVideo src={mediaUrlOf(props.viewerItem.media)} fit="contain" controls autoPlay />
          ) : (
            <MediaImage
              src={mediaUrlOf(props.viewerItem.media)}
              alt={props.viewerItem.title}
              fit="contain"
            />
          )}
        </Box>
      )}
    </Dialog>

    <UrlImportDialog
      open={props.urlDialogOpen}
      onOpenChange={props.onUrlDialogOpenChange}
      onSubmit={props.onImportUrl}
    />
  </ContextMenuRoot>
)
