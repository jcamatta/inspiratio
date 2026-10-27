# Handoff: finish the canvas redesign

Branch: `feat/reference-canvas`. The last commit is a WIP of the canvas-only redesign. Unit tests (web 70) and Playwright (4) passed locally, but `npm run verify` has not been run since.

## Tasks

1. `npm install`, then `npm run verify` (typecheck, ESLint with max-params 1, Prettier check, Vitest coverage ≥ 90%). Fix every failure without weakening rules or thresholds.
2. `npx playwright test` and keep it green.
3. Update `README.md` and `docs/architecture.md` for the canvas-only UI:
   - no toolbar, sidebar or drawer; everything goes through the context menu and drag & drop
   - prompt cards: brief, kind, model (Auto), aspect, variants, Generate; states draft → pending → in_progress → completed/failed
   - dropping images onto a draft card adds them as @n references
   - Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y undo and redo (HistoryProvider)
   - bottom bar: undo/redo, zoom, fit, selection count
   - double-click to rename, inline tag add/remove on selected images
   - Viewer (zoom/pan/close) and Details dialogs
   - toast when a queued generation finishes or fails
   - deleted items go to `data/trash` and can be restored
4. Check `.claude/skills/inspiratio-generate` still matches the flow, then delete this file.
5. Commit with conventional commits and push. Do not merge.

## Principles (non-negotiable)

Functional style with data, actions and pure functions kept apart. Base UI and lucide only, no primitive HTML in features (only `shared/ui`). Hooks only in controllers. CQS and hexagonal layers on the server. Tests in `__test__` folders. Playwright uses test ids. No explanatory comments or UI text.

## Not for the cloud

The real Higgsfield generation needs the local `data/` library and the local Inspiratio MCP, so it runs on the user's machine.
