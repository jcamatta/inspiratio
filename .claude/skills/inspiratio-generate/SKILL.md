---
name: inspiratio-generate
description: Fulfil image/video generation requests queued in the Inspiratio reference canvas. Use when the user says "process / fulfil Inspiratio generation request gen_…", "generate what I queued in Inspiratio", or asks to turn canvas references into new images or videos with Higgsfield.
---

# Inspiratio → Higgsfield generation

Inspiratio is the user's local reference canvas (`npm run dev`, http://localhost:5319). They write a prompt on a
**prompt card** on the canvas, drop reference images/videos onto it and press **Generate**. The card is a _generation
request_ (`draft` until Generate, then `pending`) that you fulfil with two MCP servers:

- `inspiratio` (this repo, `.mcp.json`): reads requests and imports results back onto the canvas.
- `higgsfield`: uploads references and generates the media.

## Workflow

1. **Find the request.** If the user gave an id (`gen_…`) use it; otherwise call `inspiratio.list_generation_requests`
   (open requests by default: `pending` and `in_progress`). With several, process them oldest first and say which ones
   you are doing. Ignore `draft` requests: the user has not pressed Generate yet.
2. **Read it.** `inspiratio.get_generation_request { id }` returns the prompt, `kind` (image | video), `model`
   (may be null), `aspectRatio`, `count` and `resolvedReferences[]` with `label` (`@1`, `@2`…), `absolutePath`,
   `mimeType`, `title`, `tags` and `notes`. Tags and notes explain _why_ the user picked each reference — use them.
3. **Mark it started.** `inspiratio.start_generation { id }` (the prompt card shows "Generating…").
   **Resuming:** if the request is already `in_progress`, a previous session stopped midway (for example it ran out of
   usage). `start_generation` still succeeds. Read its `progress` line, then check `higgsfield.show_generations` for jobs
   already submitted for this prompt. If a job finished, skip to step 8 with its URLs; if one is still running, wait
   for it; generate again only when nothing was submitted, so the user is not charged twice.
   From here on, call `inspiratio.report_progress { id, message }` before every step below and while waiting on long
   jobs (roughly every minute), with one short line such as "Uploading 2 references", "Picking a model",
   "Generating 2 images with nano_banana_pro" or "Still rendering, 3 of 4 done". While waiting on Higgsfield, include
   the job ids (e.g. "Waiting on job 7f3a…") so a later session can resume. The card shows the latest line next to a
   spinner and an elapsed timer; after 10 minutes without a report it is flagged as stalled.
4. **Upload references to Higgsfield.**
   - `higgsfield.media_upload { files: [{ filename }] }` for all references at once (use each file's basename).
   - For every returned `upload_url`, PUT the bytes from `absolutePath`:
     `curl -sS -X PUT -H "Content-Type: <mimeType>" --data-binary "@<absolutePath>" "<upload_url>"` and check HTTP 200.
   - `higgsfield.media_confirm { media_ids: [...], type: "image" }` (use `"video"` for video references,
     `type: "auto"` is not valid here — confirm images and videos in separate calls).
5. **Pick the model.** If `model` is set, use it. If null, call `higgsfield.models_explore` with
   `action: "recommend"` describing the shot (image vs video, references, style). Check the model's accepted
   `medias[].roles` and aspect ratios with `models_explore` before generating.
6. **Write the provider prompt.** Keep the user's intent and wording; replace each label with what that reference
   contributes, e.g. `@1` → "the location from reference image 1", `@2` → "the lighting and palette of reference image 2".
   Never invent references the user did not attach.
7. **Generate.** `higgsfield.generate_image` (kind = image) or `higgsfield.generate_video` (kind = video) with
   `params: { model, prompt, medias: [{ value: <media_id>, role }], aspect_ratio, count }`. Omit `aspect_ratio` when
   the request has none. Do not set `use_unlim` unless the user asked. Wait for completion with `higgsfield.jobs_wait`
   (≤ 15 s per call, repeat until terminal) and collect the result URLs.
8. **Send the results back.** `inspiratio.complete_generation { id, results: [{ url, model }] }` — one entry per output,
   with the exact Higgsfield model id. Inspiratio downloads them, places them next to the references and tags them
   `ai-generated`, `by:higgsfield`, `model:<id>`, storing the prompt as metadata.
9. **On any failure** (upload, credits, moderation, timeout) call `inspiratio.fail_generation { id, error }` with a short
   human-readable reason so it shows on the prompt card, then tell the user.

## Notes

- Inspiratio must be running (`npm run dev`); if `inspiratio` tools report "Cannot reach Inspiratio", ask the user to start it.
- Every Inspiratio call made for a request joins the trace started by the user's click, so
  `data/logs/inspiratio.ndjson` filtered by the request's `traceId` shows the whole pipeline.
- To reuse references without the app, `inspiratio.search_references { text, tags }` returns absolute paths, and
  `inspiratio.import_media { url | filePath }` adds any file to the canvas.
