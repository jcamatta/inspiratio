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

## Install (macOS, Windows, Linux)

Inspiratio runs on your own computer: a small local server plus a browser window. Your images never leave your
machine unless you press **Generate**.

### 1. Install the prerequisites (once)

| Tool                                           | macOS                                                                                         | Windows                                                          |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Node.js 22 or newer** (includes npm)         | Download the LTS installer from [nodejs.org](https://nodejs.org) or `brew install node`       | Download the LTS installer from [nodejs.org](https://nodejs.org) |
| **Git** (to download and get updates)          | Run `git --version` in Terminal; macOS offers to install it if missing                        | Install from [git-scm.com](https://git-scm.com/download/win)     |
| **Google Chrome or Microsoft Edge** (optional) | Opens Inspiratio in its own app window; without it, it opens as a tab in your default browser | Edge is already installed                                        |

Check it worked by opening a **new** terminal (macOS: _Terminal_ app · Windows: _PowerShell_) and running:

```bash
node --version
```

It should print `v22` or higher.

### 2. Download Inspiratio

The repository is private, so ask the owner to invite your GitHub account as a collaborator first. Then, in the
terminal, go to the folder where you want the app (for example your home folder) and clone it:

```bash
git clone -b main https://github.com/jcamatta/inspiratio.git
```

```bash
cd inspiratio
```

Git asks you to sign in to GitHub the first time. Keep this folder where it is: the desktop icon points to it.

### 3. Install and create the desktop icon

Still inside the `inspiratio` folder:

```bash
npm install
```

```bash
npm run shortcut
```

This creates an **Inspiratio** icon:

- **Windows**: on the Desktop and in the Start menu.
- **macOS**: `Inspiratio.app` in your `Applications` folder (inside your home folder, so it also shows up in
  Spotlight and Launchpad) plus a link to it on the Desktop. Drag it to the Dock if you like.
- **Linux**: on the Desktop (if you have one) and in the applications menu.

### 4. Open it

Double-click the **Inspiratio** icon. Each time it:

1. downloads the latest version from GitHub (if you are offline it just uses the version you have),
2. installs any new dependencies and builds the app (the first run takes a minute, later runs a few seconds),
3. starts the Inspiratio server in the background, and
4. opens the canvas in its own window at http://127.0.0.1:4319.

On Windows a minimized console window shows the progress and stays open with the error if something fails. On macOS
you get a notification while it starts, and an alert if it fails.

Closing the window does not stop the server, so opening the icon again is instant. To stop it, run `npm run stop`
in the `inspiratio` folder (restarting the computer also stops it).

### Where your library lives

Everything you add is stored in the `data` folder inside `inspiratio` (`media`, `library.json`, `trash`, `logs`).
Back that folder up to keep your boards; copying it into another Inspiratio install moves them there. Set the
`INSPIRATIO_DATA_DIR` environment variable to keep the library elsewhere.

### Troubleshooting

| Problem                                                   | Fix                                                                                                                                               |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node` or `npm` is "not recognized" / "command not found" | Install Node.js, then open a **new** terminal window.                                                                                             |
| The icon does nothing (macOS)                             | Open `data/logs/launch.log` in the `inspiratio` folder for the error. If you installed Node in another place since, run `npm run shortcut` again. |
| The icon stopped working after moving the folder          | Run `npm run shortcut` again from the new location.                                                                                               |
| "Could not update from GitHub"                            | You are offline or not signed in to GitHub; Inspiratio still opens with the version you have.                                                     |
| The server does not start                                 | See `data/logs/server.log`. Another program may be using port 4319: stop it, or set `INSPIRATIO_PORT` to another port.                            |
| `npm install` fails on `sharp` (image library)            | Make sure Node is 22 or newer and run `npm install` again with a working internet connection.                                                     |

### Development

```bash
npm run dev
```

Open http://localhost:5319 (hot reload). The API runs on http://127.0.0.1:4319.

## AI generation (optional)

Generating images and videos needs [Claude Code](https://claude.com/claude-code) and a
[Higgsfield](https://higgsfield.ai) account. The rest of the canvas works without them.

1. Install Claude Code and sign in (run `claude` once in a terminal).
2. Connect Higgsfield to Claude Code:

   ```bash
   claude mcp add --transport http higgsfield https://mcp.higgsfield.ai/mcp
   ```

   Then start `claude`, type `/mcp`, pick **higgsfield** and sign in.

Pressing **Generate** starts a headless Claude Code run (`claude -p`, Sonnet by default) limited to the Inspiratio and
Higgsfield MCP servers; it follows the guide returned by `get_generation_request` and logs to `data/agent/<id>.log`.
Set `INSPIRATIO_AGENT_MODEL` to pick another model, `INSPIRATIO_AGENT` to another command, or `INSPIRATIO_AGENT=off` to
fulfil requests from your own Claude session instead.

### Generating with Claude Code

1. Make sure the Higgsfield MCP is connected in Claude Code. This repo's `.mcp.json` registers the `inspiratio` MCP server.
2. In the app, right-click references → **Generate image** / **Generate video** (or right-click the canvas → **New image prompt** /
   **New video prompt** and drop images onto the card). Image and video prompts are separate cards. Write the brief, pick
   the model, aspect, variants and that model's settings, and press **Generate**. An instruction is copied to your clipboard.

   | Card  | Models                        | Settings                                                                                                        |
   | ----- | ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
   | Image | **Nano Banana Pro** (default) | Resolution 1k / 2k / 4k                                                                                         |
   | Image | **GPT Image 2.5**             | Variant Flare / Sunburst · Quality low → max · Resolution 1k / 2k / 4k · Background auto / opaque / transparent |
   | Image | **FLUX 3**                    | Resolution 768sq → 4k                                                                                           |
   | Video | **Seedance 2.5**              | Duration 4–30 s · Quality 480p / 720p / 1080p · Bitrate standard / high · Audio on / off                        |

   Each model has a prompt guide in `prompt-guides/` written from the provider's official docs; the agent follows it
   to turn your brief into the prompt it sends.

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

| Script                        | What it does                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| `npm run dev`                 | API (watch) + web dev server                                                                            |
| `npm run build` / `npm start` | Build the web app, then serve app + API from one process on :4319                                       |
| `npm run app`                 | What the desktop icon does: update, install, build, start the server in the background, open the window |
| `npm run stop`                | Stop the background server started by the icon                                                          |
| `npm run shortcut`            | Create the desktop icon for this folder (Windows, macOS, Linux)                                         |
| `npm run mcp`                 | Run the MCP server on stdio (Claude Code does this for you through `.mcp.json`)                         |
| `npm run verify`              | typecheck + lint + prettier check + unit tests with coverage (90% thresholds)                           |
| `npm run test:e2e`            | Playwright end-to-end tests (isolated `.e2e-data` library, includes the MCP round-trip)                 |

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
