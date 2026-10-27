# Inspiratio

A local reference canvas for short-film inspiration, in the spirit of PureRef but with video, tags, metadata, and a
built-in path from references to new AI images and videos through **Claude Code + the Higgsfield MCP**.

- Drop images and videos from your desktop or browser (Google Images, Pinterest, Cosmos, film-still sites), or paste them.
- Move, resize, z-order and zoom freely; rename captions; play, pause, restart and scrub videos.
- Global tags with an inline-create combobox; filter and dim the board; group references into sections.
- Every item carries metadata: source URL, dimensions, origin and, for AI results, provider, model and prompt.
- Compose a prompt, drag references into it (`@1`, `@2`…) and queue it. Claude Code generates it with Higgsfield and
  the result lands back on the canvas tagged `ai-generated`, `by:higgsfield`, `model:<id>`.

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

### Generating with Claude Code

1. Make sure the Higgsfield MCP is connected in Claude Code. This repo's `.mcp.json` registers the `inspiratio` MCP server.
2. In the app, right-click references → **Create image…** (or drag them into the **Generate** panel), write the prompt
   and press **Queue for Claude Code**. An instruction is copied to your clipboard.
3. Paste it into Claude Code in this folder, for example
   _"Use the inspiratio-generate skill to fulfil Inspiratio generation request gen_…"_.
   The skill (`.claude/skills/inspiratio-generate`) uploads the references, generates with Higgsfield and imports the result.

### Canvas controls

| Action         | How                                                                                  |
| -------------- | ------------------------------------------------------------------------------------ |
| Import         | Drop files / images from a web page, `Ctrl+V`, toolbar import or **Import from URL** |
| Zoom / pan     | Scroll to zoom · `Space` + drag or middle-click drag to pan · toolbar fit            |
| Select         | Click · `Shift`/`Ctrl` click · drag a box on empty canvas                            |
| Rename         | Double-click the caption (or edit in the Inspector)                                  |
| Resize         | Drag the corner handles of a selected item (aspect ratio is kept)                    |
| Sections       | Toolbar or right-click canvas › **Add section**; drag items in and out               |
| Delete         | `Delete` / `Backspace` or right-click › Delete (files go to `data/trash`)            |
| View full size | Toolbar of a selected item or right-click › View full size                           |

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
