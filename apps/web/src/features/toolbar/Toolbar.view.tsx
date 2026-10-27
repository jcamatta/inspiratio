import type { Tag } from '@inspiratio/shared'
import {
  FolderInput,
  Link2,
  Maximize,
  PanelRight,
  Search,
  SquareDashed,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import {
  FilePicker,
  IconButton,
  Panel,
  Separator,
  Stack,
  Text,
  TextField,
} from '../../shared/ui/index.ts'
import type { ItemFilter } from '../board/domain/flow-mapping.ts'
import { UrlImportDialog } from '../board/UrlImportDialog.controller.tsx'
import { TagPicker } from '../tags/TagPicker.controller.tsx'

export type ToolbarViewProps = {
  readonly zoom: number
  readonly tags: readonly Tag[]
  readonly filter: ItemFilter
  readonly panelOpen: boolean
  readonly itemCount: number
  readonly onFilterChange: (filter: ItemFilter) => void
  readonly onFiles: (files: File[]) => void
  readonly urlOpen: boolean
  readonly onUrlOpenChange: (open: boolean) => void
  readonly onImportUrl: (url: string) => void
  readonly onAddSection: () => void
  readonly onZoomIn: () => void
  readonly onZoomOut: () => void
  readonly onFitView: () => void
  readonly onTogglePanel: () => void
}

export const ToolbarView = (props: ToolbarViewProps) => (
  <Stack
    direction="row"
    align="center"
    gap={3}
    className="h-14 shrink-0 border-b border-border bg-panel px-4"
    testId="toolbar"
  >
    <Stack direction="row" align="center" gap={2} className="pr-2">
      <Text className="size-6 rounded-md bg-primary text-center text-sm leading-6 font-bold text-primary-foreground">
        i
      </Text>
      <Text variant="title">Inspiratio</Text>
      <Text variant="caption">{props.itemCount} refs</Text>
    </Stack>

    <Panel className="flex items-center gap-0.5 rounded-xl p-0.5 shadow-none">
      <FilePicker
        label="Import files"
        icon={FolderInput}
        accept="image/*,video/*"
        onFiles={props.onFiles}
        testId="file-input"
      />
      <IconButton
        icon={Link2}
        label="Import from URL"
        onClick={() => props.onUrlOpenChange(true)}
        testId="toolbar-import-url"
      />
      <IconButton
        icon={SquareDashed}
        label="Add section"
        onClick={props.onAddSection}
        testId="toolbar-add-section"
      />
    </Panel>

    <Stack direction="row" align="center" gap={2} className="min-w-0 flex-1">
      <Search size={15} className="shrink-0 text-muted-foreground" />
      <TextField
        dense
        placeholder="Search titles, notes, prompts…"
        value={props.filter.text}
        onValueChange={(text) => props.onFilterChange({ ...props.filter, text })}
        className="w-56"
        testId="filter-text"
        aria-label="Search"
      />
      <TagPickerFilter {...props} />
    </Stack>

    <Stack direction="row" align="center" gap={0}>
      <IconButton icon={ZoomOut} label="Zoom out" onClick={props.onZoomOut} />
      <Text variant="mono" className="w-11 text-center" testId="zoom-level">
        {Math.round(props.zoom * 100)}%
      </Text>
      <IconButton icon={ZoomIn} label="Zoom in" onClick={props.onZoomIn} />
      <IconButton
        icon={Maximize}
        label="Fit everything"
        onClick={props.onFitView}
        testId="toolbar-fit"
      />
      <Separator orientation="vertical" />
      <IconButton
        icon={PanelRight}
        label="Toggle side panel"
        active={props.panelOpen}
        onClick={props.onTogglePanel}
        testId="toolbar-panel"
      />
    </Stack>

    <UrlImportDialog
      open={props.urlOpen}
      onOpenChange={props.onUrlOpenChange}
      onSubmit={props.onImportUrl}
    />
  </Stack>
)

const TagPickerFilter = (props: ToolbarViewProps) => (
  <Stack className="w-72 min-w-0">
    <TagPicker
      tags={props.tags}
      value={props.filter.tagIds}
      onChange={(tagIds) => props.onFilterChange({ ...props.filter, tagIds })}
      creatable={false}
      placeholder="Filter by tags…"
      testId="filter-tags"
    />
  </Stack>
)
