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
   (may be null), `aspectRatio`, `count`, `resolvedOptions` (the model settings picked on the card) and `resolvedReferences[]` with `label` (`@1`, `@2`…), `absolutePath`, `uploadPath`, `uploadMimeType`,
   `mimeType`, `title`, `tags` and `notes`. Tags and notes explain _why_ the user picked each reference — use them.
   It also returns `promptGuide { model, guide, content }`: the model to generate with and the prompt guide for it
   (`prompt-guides/<model>.md` at the repo root, or `prompt-guides/default.md` when that model has no guide).
3. **Mark it started.** `inspiratio.start_generation { id }` (the prompt card shows "Generating…").
   **Resuming:** if the request is already `in_progress`, a previous session stopped midway (for example it ran out of
   usage). `start_generation` still succeeds. Read its `progress` line, then check `higgsfield.show_generations` for jobs
   already submitted for this prompt. If a job finished, skip to step 8 with its URLs; if one is still running, wait
   for it; generate again only when nothing was submitted, so the user is not charged twice.
   From here on, call `inspiratio.report_progress { id, message }` once per phase ("Uploading references",
   "Generating with nano_banana_pro (job 7f3a…)", "Importing results"), and about every minute on long video jobs. Include
   the job ids so a later session can resume. The card shows the latest line next to a spinner and an elapsed timer;
   after 10 minutes without a report it is flagged as stalled.
4. **Upload references to Higgsfield.** A reference whose `providerMediaIds.higgsfield` is set was uploaded before:
   use that media id and skip it here.
   - `higgsfield.media_upload { files: [{ filename }] }` for all references at once (use the basename of each `uploadPath`).
   - For every returned `upload_url`, PUT the bytes from `uploadPath` (a resized JPEG copy when the original is large;
     never upload `absolutePath`, big originals get dropped by the upload server):
     `curl -sS -o /dev/null -w "%{http_code}" -X PUT -H "Content-Type: <uploadMimeType>" --data-binary "@<uploadPath>" "<upload_url>"`,
     all PUTs chained with `&&` in a single Bash command, and check every HTTP 200.
   - `higgsfield.media_confirm { media_ids: [...], type: "image" }` (use `"video"` for video references,
     `type: "auto"` is not valid here — confirm images and videos in separate calls).
5. **Use the model from the request.** Generate with `promptGuide.model`, always. The server already resolved it:
   the model the user selected, or `nano_banana_pro` for images and `seedance_2_5` for videos when it has none. Never pick
   another model and do not call `higgsfield.models_explore` unless the guide tells you to check roles or aspect ratios.
6. **Write the provider prompt by following the guide.** `promptGuide.content` is the prompt guide for that model:
   follow it exactly (structure, wording rules, what to avoid). Keep the user's intent and replace each label with what
   that reference contributes, e.g. `@1` → "the location from reference image 1", in the way the guide describes.
   Never invent references the user did not attach.
7. **Generate.** `higgsfield.generate_image` (kind = image) or `higgsfield.generate_video` (kind = video) with
   `params: { model, prompt, medias: [{ value: <media_id>, role }], aspect_ratio, count, ...resolvedOptions }`. Omit
   `aspect_ratio` when the request has none. `resolvedOptions` holds the user's settings (resolution, quality, variant,
   background, duration, bitrate_mode, generate_audio…) keyed by Higgsfield param: pass them unchanged, never override
   them. Params the guide asks you to choose (such as `mode` for Seedance) come from the guide. Do not set `use_unlim` unless the user asked. Wait for completion with `higgsfield.jobs_wait`
   (≤ 15 s per call, repeat until terminal) and collect the result URLs.
8. **Send the results back.** `inspiratio.complete_generation { id, results: [{ url, model }], providerPrompt, promptGuide, uploads }` — one
   entry per output, with the exact Higgsfield model id, `providerPrompt` set to the exact prompt you sent (the
   user reads it under "Sent to higgsfield" in Details) and `promptGuide` set to `promptGuide.guide` (stored on each result). Inspiratio downloads them, places them next to the references and tags them
   `ai-generated`, `by:higgsfield`, `model:<id>`, storing the prompt as metadata. `uploads: [{ itemId, mediaId }]` lists
   the references you uploaded in step 4 so the next request reuses them.
9. **On any failure** (upload, credits, moderation, timeout) call `inspiratio.fail_generation { id, error }` with a short
   human-readable reason so it shows on the prompt card, then tell the user.

## Notes

- Pressing Generate already starts a headless Sonnet run of this workflow (logs in `data/agent/<id>.log`); a manual
  run is only needed when the server was started with `INSPIRATIO_AGENT=off` or the automatic run failed.
- Inspiratio must be running (`npm run dev`); if `inspiratio` tools report "Cannot reach Inspiratio", ask the user to start it.
- Every Inspiratio call made for a request joins the trace started by the user's click, so
  `data/logs/inspiratio.ndjson` filtered by the request's `traceId` shows the whole pipeline.
- To reuse references without the app, `inspiratio.search_references { text, tags }` returns absolute paths, and
  `inspiratio.import_media { url | filePath }` adds any file to the canvas.
