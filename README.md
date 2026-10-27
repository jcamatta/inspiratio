# Inspiratio

A local reference canvas for short-film inspiration, in the spirit of PureRef but with video, tags, metadata, and a
built-in path from references to new AI images and videos through **Claude Code + the Higgsfield MCP**.

- Canvas only: no toolbar, sidebar or drawer. Everything goes through the right-click context menu and drag & drop.
- Drop images and videos from your desktop or browser (Google Images, Pinterest, Cosmos, film-still sites), or paste them.
- Move, resize, z-order and zoom freely; double-click to rename; play, pause, restart and scrub videos.
- Global tags added and removed inline on selected images; group references into sections.
- Every item carries metadata (source URL, dimensions, origin and, for AI results, provider, model and prompt), shown
  in the **Details** dialog; **View full size** opens a viewer with zoom, pan and close.
- Undo and redo every board change with `Ctrl+Z` and `Ctrl+Shift+Z` / `Ctrl+Y`.
- Prompt cards live on the canvas: drop references onto them (`@1`, `@2`…) and press **Generate**. Claude Code
  generates with Higgsfield and the result lands back on the canvas tagged `ai-generated`, `by:higgsfield`,
  `model:<id>`. A toast tells you when a queued generation finishes or fails.

## Quick start

Requirements: Node 22+ (tested on 24) and npm.

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5319. The API runs on http://127.0.0.1:4319. Your library lives in `./data` (media files,
`library.json`, logs, trash); set `INSPIRATIO_DATA_DIR` to keep it elsewhere.

On Windows, `scripts\launch.cmd` builds the web app, starts the server in a minimized "Inspiratio server" window
(close it to stop) and opens http://127.0.0.1:4319 as an Edge app window. Point a desktop shortcut at it with
`scripts\inspiratio.ico` as its icon.

Pressing **Generate** starts a headless Claude Code run (`claude -p`, Sonnet by default) limited to the Inspiratio and
Higgsfield MCP servers; it follows the guide returned by `get_generation_request` and logs to `data/agent/<id>.log`.
Set `INSPIRATIO_AGENT_MODEL` to pick another model, `INSPIRATIO_AGENT` to another command, or `INSPIRATIO_AGENT=off` to
fulfil requests from your own Claude session instead.

### Generating with Claude Code

1. Make sure the Higgsfield MCP is connected in Claude Code. This repo's `.mcp.json` registers the `inspiratio` MCP server.
2. In the app, right-click references → **Generate image** / **Generate video** (or right-click the canvas → **New image prompt** /
   **New video prompt** and drop images onto the card). Write the brief, pick the kind, model (**Auto** by default), aspect and variants, and
   press **Generate**. An instruction is copied to your clipboard.
3. Paste it into Claude Code in this folder, for example
   _"Use the inspiratio-generate skill to fulfil Inspiratio generation request gen_…"_.
   The skill (`.claude/skills/inspiratio-generate`) uploads the references, generates with Higgsfield and imports the result.

A prompt card moves through `draft → pending → in_progress → completed | failed`; a failed card can be retried. While
it is queued or generating, the card shows a spinner, the elapsed time and the latest status line Claude reported
(`report_progress`). **Cancel** stops a queued or running card. If a running card gets no report for 10 minutes
(for example the Claude session ran out of usage) it is flagged as stalled and offers **Requeue**; a new Claude
session can also pick it up directly, since `list_generation_requests` returns unfinished requests and
`start_generation` resumes them. Select a prompt card and drag its handles to resize it; the brief grows with it.

### Canvas controls

| Action         | How                                                                                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Import         | Drop files / images from a web page, `Ctrl+V` or right-click canvas › **Import from URL…**                                                     |
| Zoom / pan     | Scroll to zoom · `Space` + drag or middle-click drag to pan · bottom bar zoom and fit                                                          |
| Select         | Click · `Shift`/`Ctrl` click · drag a box on empty canvas · right-click › **Select all images**                                                |
| Rename         | Double-click an image caption or section title, or right-click › **Rename**                                                                    |
| Tags           | Select an image and add or remove tags inline, or right-click › **Add tags**                                                                   |
| Resize         | Drag the handles of a selected item (aspect ratio is kept), section or prompt card                                                             |
| Sections       | Select one or more images › **Create section** in the floating toolbar or right-click menu; or canvas › **Add section**; drag items in and out |
| Prompts        | Right-click images › **Generate image/video**, or canvas › **New image/video prompt**; drop images onto a draft card                           |
| Undo / redo    | `Ctrl+Z` · `Ctrl+Shift+Z` / `Ctrl+Y` · bottom bar                                                                                              |
| Delete         | `Delete` / `Backspace` or right-click › Delete (files go to `data/trash` and come back on undo)                                                |
| View / details | Right-click › **View full size** (zoom, pan, close) or **Details**                                                                             |

A floating toolbar above the selected images offers Generate image/video, Create section, View full size and Details
(single image) and Delete. The bottom bar holds undo/redo, zoom out/in with the current zoom level, fit to screen and the selection count.

## Scripts

| Script                        | What it does                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| `npm run dev`                 | API (watch) + web dev server                                                            |
| `npm run build` / `npm start` | Build the web app, then serve app + API from one process on :4319                       |
| `npm run mcp`                 | Run the MCP server on stdio (Claude Code does this for you through `.mcp.json`)         |
| `npm run verify`              | typecheck + lint + prettier check + unit tests with coverage (90% thresholds)           |
| `npm run test:e2e`            | Playwright end-to-end tests (isolated `.e2e-data` library, includes the MCP round-trip) |

## Project layout

```
apps/server     Express API + MCP server (vertical slices: items, tags, sections, generations, logs)
apps/web        Vite + React + React Flow + Base UI (controller / view components)
packages/shared zod contracts, trace context, log records, Result type
e2e             Playwright specs and fixtures
docs            architecture.md · research.md (PureRef and alternatives)
```

See [docs/architecture.md](docs/architecture.md) for the principles (functional core, hexagonal ports, CQS,
single-parameter functions, structured logging and end-to-end tracing) and how each one is enforced.

## Conventions

- Conventional Commits (commitlint) and conventional branches (`feat/…`, `fix/…`, checked on push).
- ESLint (strict type-checked, `max-params: 1`, no classes, no raw HTML in features, no hooks in views) and Prettier,
  both run on staged files by Husky + lint-staged.
- Tests live in `__test__/` folders next to the code.
