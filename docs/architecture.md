# Architecture

## Overview

```
┌────────────── Browser (apps/web) ──────────────┐        ┌──────── Claude Code ────────┐
│ React + React Flow canvas, Base UI controls    │        │  inspiratio-generate skill  │
│ controller → view components, TanStack Query   │        └──────┬───────────────┬──────┘
│ browser logger ──┐   http client (traceparent) │               │ MCP (stdio)   │ MCP
└──────────────────┼───────────────┬─────────────┘        ┌──────▼──────┐ ┌──────▼──────┐
                   │ /api/logs     │ /api/*               │ inspiratio  │ │ higgsfield  │
┌──────────────────▼───────────────▼─────────────┐  HTTP  │ MCP server  │ │ (cloud)     │
│ Express backend (apps/server)                  │◄───────┤ apps/server │ └─────────────┘
│ vertical slices: items · tags · sections ·     │        │ /src/mcp    │
│ generations · logs                             │        └─────────────┘
│ JSON library + media folder on disk            │
└────────────────────────────────────────────────┘
```

- **packages/shared**: zod contracts (one source of truth for request/response types), W3C trace helpers,
  log record schema, `Result` type, placement helpers.
- **apps/server**: Express API, also hosts the MCP server (`src/mcp`) which talks to the API over HTTP so the app
  and the agent always see the same state.
- **apps/web**: Vite + React app.

## Principles and how they are enforced

| Principle                                      | How                                                                                                                                                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Functional core: data, pure functions, actions | Domain modules (`*/domain/*.ts`) are pure. Application modules are _actions_: they read state, call pure functions and perform effects through injected ports. ESLint bans classes.                          |
| One parameter per function                     | ESLint `max-params: 1`. Only third-party signatures are exempt (`express-adapter.ts`, `compare.ts`, React's reducer).                                                                                        |
| Hexagonal ports & adapters                     | Ports: `LibraryStore`, `MediaStorage`, `LocalFileReader`, `FetchFn`, `Clock`, `IdGenerator`, `Logger`. Adapters: file / memory store, fs / memory storage, real / fake fetch. Wired in `app.ts` / `main.ts`. |
| Controller → service → repository → domain     | `http/*.routes.ts` (controller) → `application/*.commands.ts                                                                                                                                                 | queries.ts`(service) →`LibraryStore`(repository port) →`domain/*.ts`. |
| Command-query separation                       | Queries are `GET` and return data. Commands are `POST/PATCH/PUT/DELETE`, change state and return at most the created id (`201 {id}`) or `204`.                                                               |
| Vertical slices                                | `apps/server/src/features/<slice>` and `apps/web/src/features/<slice>`.                                                                                                                                      |
| Controller / view (frontend)                   | `*.controller.tsx` is the only place hooks run; `*.view.tsx` only receives props and lays out. ESLint forbids hook calls in views.                                                                           |
| Base UI only                                   | Feature code cannot use raw HTML elements (ESLint `no-restricted-syntax` on lowercase JSX). Primitives live in `apps/web/src/shared/ui`, built on Base UI + design tokens + lucide icons.                    |
| 100% typed                                     | `strict`, `noUncheckedIndexedAccess`, typescript-eslint `strictTypeChecked`, no `any`, zod validation on every boundary.                                                                                     |
| Tests next to code                             | `__test__/` folders beside the code. Vitest (unit/integration) with 90% thresholds; Playwright for e2e.                                                                                                      |

## Data model

- **Item**: image or video file in `data/media/<id>.<ext>`, with `title`, canvas `position`/`size`/`zIndex`,
  optional `sectionId` (position becomes relative to the section), `tagIds` and `metadata` (`origin`, `sourceUrl`,
  `originalFileName`, `notes`, `generation { provider, model, prompt, referenceItemIds, requestId }`).
- **Tag**: global, case-insensitive unique name, colour, `system` flag (`ai-generated`, `by:<provider>`, `model:<id>`).
- **Section**: titled frame on the canvas; deleting it keeps its items in place.
- **GenerationRequest**: prompt + labelled references (`@1`, `@2`…), kind, model, aspect ratio, count, status
  (`pending → in_progress → completed | failed`, `failed → pending` on retry) and the `traceId` of the click that
  created it.

All of it lives in `data/library.json` (written atomically) next to the media folder. Deleted files go to
`data/trash`, never hard-deleted.

## Structured logging and tracing

- Every service builds `LogRecord`s (`ts, level, service, msg, traceId, spanId, parentSpanId, fields`) with a small
  custom logger. Sinks: pretty/JSON stream + the shared NDJSON file `data/logs/inspiratio.ndjson`.
- The browser starts a trace per user action (`startAction`) and sends a W3C `traceparent` header on every request;
  browser logs are batched to `POST /api/logs` and written to the same file.
- The backend continues the incoming trace (`AsyncLocalStorage`) so every log line of the request carries it, and
  returns `traceparent` in the response.
- Generation requests store the trace id; the MCP server resumes it for every tool call on that request. One
  `traceId` therefore links the click in the UI, the API calls, the MCP tool calls and the import of the result:

```bash
grep <traceId> data/logs/inspiratio.ndjson
```

## Generation pipeline

1. In the app: right-click references → **Create image/video…**, or drag them (grip icon) into the prompt. Each
   reference gets a token `@n`.
2. **Queue for Claude Code** creates a `GenerationRequest` and copies an instruction to the clipboard.
3. In Claude Code the `inspiratio-generate` skill uses the `inspiratio` MCP to read the request (absolute file paths,
   tags, notes), the `higgsfield` MCP to upload and generate, and `complete_generation` to send result URLs back.
4. The backend downloads the results, places them next to the references and tags them. The queue updates live.
