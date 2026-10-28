# Higgsfield Elements

Research note, 2026-10-28. Sources: Higgsfield MCP tool schemas (`manage_reference_elements`,
`show_reference_elements`, `generate_image`, `generate_video`, `models_explore get`) plus a read-only
`list` of the workspace's elements, and the Higgsfield blog. Nothing was created or generated.

## What an Element is

An Element is a **named, saved reference stored on Higgsfield's side, per workspace**. In the UI it is the
"@ Elements" picker next to "References".

- Fields: `id` (UUID), `name` (at most 32 chars, unique per workspace, spaces become `-`, a numeric suffix
  is added on collision), `category` (`character` | `environment` | `prop`, or `auto` to let the server
  classify it), `description` (free text, stored as-is), `medias[]` (images: `{id, url, type: media_input | image_job}`),
  `video_medias[]`, `status`, `created_at`.
- Status: only `completed` is usable. The others are `processing`, `ip_checking` (it runs an IP/likeness check),
  `failed`, `kling_failed` and `nsfw`.
- It is created from images you have already uploaded (`media_upload` → PUT → `media_confirm`) or from a
  completed generation (`image_job`). `create` returns synchronously.
- Soul ID characters (trained from 5–20 photos) are also saved as Reference Elements, according to the blog.
- This workspace already has four, all from the "Before / Now" film: `c-man`, `c-family` (characters),
  `l-room` (environment) and `p-frame` (prop). Each has one image and a long description. So the user
  already works this way in the Higgsfield UI.

## How to use one in a generation (MCP)

Put the placeholder `<<<element_uuid>>>` **inside `params.prompt`** of `generate_image` / `generate_video`.
The backend injects the element's image(s) and rewrites the placeholder to `@element_name` before the
model sees the prompt. You can use several per prompt:

```json
{
  "model": "nano_banana_pro",
  "prompt": "<<<a6a30810-...>>> kneels by the fireplace in <<<59ac24bb-...>>>, holding <<<20e5b086-...>>>"
}
```

Guards from the schema:

- Writing `@name` in a tool call does **not** work. Only `<<<UUID>>>` works.
- Do **not** put element ids in `params.medias`. The placeholder already injects the images.
- Kling 3.0 only honours elements when a `start_image` is in `medias`.
- Models not on the list **silently ignore** the placeholder. The UUID text stays in the prompt as noise.

## Model support (per the schema's whitelist)

| Our model         | Element placeholder                            | Notes                                                                                                                |
| ----------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `nano_banana_pro` | **Yes**, listed                                | `medias` role `image_references`                                                                                     |
| `gpt_image_2_5`   | **Not listed** (the list names `gpt_image_2`)  | role `image_references`                                                                                              |
| `flux_3_image`    | **No**                                         | up to 10 `image_references`                                                                                          |
| `seedance_2_5`    | **Not listed** (the list names `seedance_2_0`) | roles `start_image`, `end_image`, `image_references`, `video_references`, `audio_references`; `mode: omni_reference` |

Also listed: `nano_banana_2`, `seedream_v4_5`, `seedream_v5_lite`, `cinematic_studio_2_5`,
`cinematic_studio_video_v2`, `cinematic_studio_3_0`, `seedance_2_0`, `kling3_0`.
The whitelist may simply lag behind the 2.5 releases. That is unverified, and testing it would spend credits.

## Elements vs. plain references

|                       | Plain reference (what Inspiratio does today) | Element                                                                          |
| --------------------- | -------------------------------------------- | -------------------------------------------------------------------------------- |
| Lives                 | on disk in the canvas, uploaded per request  | on Higgsfield, persistent, per workspace                                         |
| Upload                | every generation (new media_id each time)    | once; later uses are just a UUID in the prompt                                   |
| Binding to the prompt | positional (as `image 1`, `image 2`, ...)    | named: becomes `@c-man` in the prompt, so the model knows _which_ image is _who_ |
| Models                | any model with `image_references`            | whitelist only                                                                   |
| Extra data            | none                                         | category and description (not documented as sent to the model)                   |

An Element is **not a trained model**. A plain Element is just its stored images plus a name, and the server
injects them as references. So for consistency it should do about as well as passing the same image as a
reference. The real gains are:

1. A stable name the prompt can refer to, which matters most with 3 or more references in one shot.
2. No re-upload.
3. The same asset as in the Higgsfield web UI.

Soul ID Elements (trained) are the exception: they do carry a learned identity.

Cost: neither the schema nor the docs mention a charge for `create`/`list`/`get`. Generation is billed as usual.
Soul ID training costs about 25 credits once (blog). Limits seen: name of at most 32 chars; `medias` are https
Higgsfield URLs only, no local or loopback hosts; the number of elements per prompt is not documented. The
model's own reference cap still applies: Seedance takes up to 9 inputs, FLUX up to 10.

## Recommendation for Inspiratio

**Yes, but as an optional layer, with a portable fallback.**

1. **Model**: an Inspiratio tag or item gets an optional `higgsfieldElement: { id, name, category, mediaIds[] }`.
   Good candidates are items tagged `character:*`, `location:*` or `prop:*`, or a "bible" image the user
   marks as canonical.
2. **Create**: a "Save as Element" action in the item context menu or the Details panel (name defaults to
   the tag slug, e.g. `c-man`; category comes from the tag prefix). The agent uploads the item, then calls
   `manage_reference_elements create`. Show a status chip until the element is `completed`. Also offer
   "Link existing Element", which uses `list` to show the four elements the user already has.
3. **Prompt card**: an `@` autocomplete in the prompt text. It inserts a chip `@c-man` that stores the
   element id. Dropping an item that has a linked Element onto a card adds the chip instead of a plain
   reference.
4. **Agent (skill) rule**, chosen per model at generation time:
   - Model on the whitelist (today, of ours, only `nano_banana_pro`): replace each chip with `<<<uuid>>>`
     and do not upload those references again.
   - Model not on it (`gpt_image_2_5`, `flux_3_image`, `seedance_2_5`): **expand** the element. Pass
     its `medias[].id` (a `media_input` id or `image_job` id, both valid `medias[].value`) as
     `image_references` (video: also `video_medias` → `video_references`), and write the element's name
     into the prompt as a descriptor ("the man from image 1"). This still saves the re-upload and keeps
     the naming discipline.
   - Record in "Sent to higgsfield" which path was used.
5. **Verify before relying on it**: run one cheap `gpt_image_2_5` and one `seedance_2_5` test with a
   placeholder (the user approves the cost). If the server rewrites to `@name`, move those models to the
   placeholder path. Until then, keep the expand fallback as the default for them.
6. Don't auto-create elements on every drop. Elements are workspace-global and go through an IP check.
   Keep creation an explicit user action.

UI needed: a "Save as / Link Element" action, an element status chip on items, `@` autocomplete with
chips in the prompt card, a small Elements list (synced via `list`), and a per-request note showing
placeholder vs. expanded.
