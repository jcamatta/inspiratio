# Prompt guide: FLUX 3 Image (`flux_3_image`)

You are rewriting the user's short brief into the prompt FLUX 3 Image (Black Forest Labs, image generation and multi-reference editing) will receive. Write the final prompt in English; keep any text that must appear in the image verbatim, in quotes (FLUX 3 renders non-English quoted text too).

Source note: BFL's official FLUX 3 Image prompting guides (docs.bfl.ai "unified" and "editing" guides) are the basis of this file. Where those guides illustrate a point with FLUX.2 examples, or where a rule comes only from FLUX.2 docs (JSON prompting, hex colours), that is said explicitly below. FLUX 3 Image was announced in July 2026 as a pre-release model, so BFL's guidance may still change.

## What the model is

- Strengths: precise instruction-based edits ("change only…"); up to ten reference images in one request, each given a role by position; strong handling of complex multi-element prompts; accurate in-image text, including multi-line poster typography and several languages; wide range of styles; exact colours via hex codes in edits; optional bounding-box layout control; outputs up to 4k.
- Prompt expansion: FLUX 3 Image rewrites short prompts into a detailed description before generating. You do not need to pad the prompt; you DO need to state the things the expansion must not guess (reference roles, what stays, positions, exact text).
- No `negative_prompt`, no `guidance`, no `seed`: the prompt carries all control, and repeated runs differ.
- Weaknesses: when several things match the target ("the bird", "the car"), the edit may hit the wrong one; recolours spread into areas you meant to keep (skin, bare parts) unless excluded; shadows, reflections and nearby light can still shift around an edited area; vague words ("make it better", "vintage", "aesthetic") give unpredictable results.
- Results go wrong when: a reference has no stated role (it is blended in, subjects included), the base image is not first, the preserve list is only "the rest of the image", or the prompt is a quality-tag stack.

## Before you write

1. View every reference file (Read its uploadPath) and note in a few words what each shows. You need this to name targets precisely and to name what must NOT be copied.
2. Give each reference one role from the brief. BFL's roles: subject (a person/character to keep recognisable), product (an object whose shape, colour or label must stay), setting (the scene), style (palette, medium, texture, lighting). Add "base" for the image being edited. "Edit @N" makes @N the base; when ambiguous, @1 is the base. One image may carry two roles (e.g. material and background) if the brief says so.

## References

- Higgsfield media role: `image_references`, up to ten images. Pass media ids in `medias` in label order (@1 first, @2 second…). The model reads them as "image 1", "image 2"… in that order.
- The base image should be @1. With aspect ratio `auto`, the output takes image 1's shape. If the brief's base is not @1 (e.g. "edit @3 in the style of @1"), keep the label order in `medias` (so the numbering in the prompt stays right) and say plainly in the first sentence which image is the base; if the shape matters, set an explicit aspect ratio closest to the base image.
- In the prompt, replace every @N with "image N" plus its role on first mention ("image 1, the moorland photo"), then use exactly the same wording ("image 1") every time. BFL asks for consistent naming per image.
- Describe how the pieces relate (who stands where, what sits on what, whose lighting wins), not just which parts come from where.
- References must be at least 256 × 256 px and at most 16 MP.

## Prompt structure

- Natural sentences that connect details (where the light falls, what is in focus). Short phrases are fine for style, colour and light. No quality tags ("masterpiece", "8k", "highly detailed", "ultrarealistic"); at most one realism cue, better a concrete one ("visible film grain"). Delete any sentence that does not describe something visible.
- Early words carry the most weight: put first whatever matters most (usually the medium and the subject).
- Generation order (BFL's starting template): image type and medium → subject and action, with positions → setting → light (source, direction, quality, colour) → framing (shot size, angle, lens, depth of field) → reference roles. Skip slots that do not apply.
- Edit order (BFL's three parts): name the target so only one thing matches (position, size, colour, neighbours) → state the change (current element → new form) → name every major element that must stay. For several changes in one image, BFL's "edit record": "Modify image 1 by making two replacements: …", then each change with location, subject and new form, then the full keep list.
- Length: short prompts work because of expansion. Edits 40–120 words; generations 40–150 words. Go longer only for several subjects, a specific layout, or in-image text.
- Negations: there is no negative prompt. BFL says to replace negative phrasing with a positive description placed early ("a deserted beach", "the moor is empty"). Exclusions inside an edit instruction are used in BFL's own examples and do work ("exclude her skin completely from recolouring", "no moss, no algae, no green tint" for a removal). So: describe what IS there first, then at most one short exclusion line naming concrete things that could leak in.
- Removals are direct instructions: "Remove the white car parked on the right; the pavement continues behind it."
- Text: exact words in quotes with the exact capitalisation, then placement and typography (weight, case, colour, font character). `\n` inside the quote for line breaks.
- Colours: in edits, a hex code tied to one named object ("recolour only the front door to #1f4d3a"). For generation, BFL's FLUX 3 guide says describe palettes in words ("muted beige and forest-green tones"); hex prompting for generation is documented only for FLUX.2.
- JSON / structured prompting: BFL documents whole-prompt JSON only for FLUX.2, not for FLUX 3. For FLUX 3 write sentences. The one structured form FLUX 3 documents is bounding-box rows (below).

## Bounding boxes (optional, use sparingly)

FLUX 3 accepts layout rows appended to the end of the prompt string: caption elements tagged `<id>`, then a space and a JSON array of rows. Boxes are `[top, left, bottom, right]` on a 0–1000 grid that stretches with the frame. In box rows `ref_image_0` is image 1, `ref_image_1` is image 2 (zero-based, unlike the prose). Edit rows use `from`, `src_bbox`, `tgt_bbox`, `desc`; a Keep row has identical source and target boxes; `from: null` adds, `tgt_bbox: null` removes.

Use boxes only when the brief needs an exact position or several similar objects match the target, and only with a known, explicit aspect ratio (not `auto` with unknown reference shape). Keep boxes large (tiny boxes for new elements often fail), repeat any addition or removal in the prose too, and treat placement as a strong hint, not a guarantee. For ordinary briefs, plain words ("on the left third", "in the lower right corner") are enough.

## Pattern (a): style transfer onto a base image

Brief: `@1 @2 edit image @1 in the style of @2`. @1 = photo of a stone temple on a hill at sunset; @2 = a Japanese woodblock print of a fisherman in a boat under a large wave.

Bad (lets the fisherman and wave appear, and the temple drift):

```
Edit image @1 in the style of image @2
```

Good:

```
Turn image 1 (a photograph of a stone temple on a hill at sunset) into a Japanese woodblock print in the style of image 2. Image 1 is the only source of content: keep the temple's shape, its layout, the hill, the horizon line, the framing and the sunset light coming from the left. From image 2 take only the medium: flat areas of colour, bold dark outlines, carved-line texture, visible paper grain and its indigo, cream and rust palette. The print shows only the temple scene of image 1; no fisherman, no boat, no wave from image 2.
```

## Pattern (b): object or subject from one reference into another's scene

Brief: `@1 @2 put the lamp from @2 on the sideboard in @1`.

```
Place the ceramic lamp from image 2 (white glazed base, linen shade) on the oak sideboard in image 1, standing on the right end of the sideboard next to the books. The lamp keeps the exact shape, glaze and shade of image 2, at a size that fits the sideboard, and takes image 1's soft window light from the left with a matching shadow on the wall. Keep the rest of the room in image 1 exactly unchanged: the sideboard, books, painting, walls, floor, window, colours and camera angle.
```

For a person: "the woman from image 2, same face, hair, build and clothes", plus her position and action in image 1's scene, and "she takes the evening light of image 1".

## Pattern (c): local edit, change one thing

Brief: `@1 make the dress dark green`.

```
In image 1, change only the colour of the woman's dress to #1f4d3a. Preserve the dress's lace embroidery, fabric texture, highlights and folds. Exclude her skin, hair, shoes and the background completely from the recolouring. Keep her pose, the garden, the light and the camera framing exactly as they are.
```

One target per edit is the most reliable. If the brief asks for several, use the edit-record form and still give each target an unambiguous location.

## Pitfalls

- Bare "@2" or "the reference": always "image N" plus a role, same wording every time.
- Style reference with a strong subject and no exclusion: name the subject you saw and keep it out.
- Base image not first while aspect ratio is `auto`: the output takes the wrong shape.
- "Keep the rest" alone: list the major elements, light and camera angle.
- Ambiguous target ("the bird", "the car"): add position, colour or a neighbour, or a box row.
- A long list of "no …" instead of a positive description; quality tags; mood words instead of visible facts.
- Unquoted or unplaced text; asking for text but not saying where it goes.
- Writing aspect ratio, resolution, "4K", "16:9" or "two variations" in the prompt text.

## Settings

The app stores the user's choices in `request.resolvedOptions` (for this model `{ resolution }`); pass them as Higgsfield params unchanged.

- `resolution`: 768sq | 1k | 1.5k | 2k | 4k (default 1k; exact pixels depend on the aspect ratio). Pass the request's value unchanged; never upgrade or downgrade it. Higgsfield does not expose BFL's `match_input`.
- `batch_size`: pass the request's `count` (the card's Variants, 1–4).
- `aspect_ratio`: auto, 21:9, 2:1, 16:9, 3:2, 7:5, 4:3, 5:4, 1:1, 4:5, 3:4, 5:7, 2:3, 9:16, 1:2. Use the request's value. `auto` follows image 1; with no references `auto` gives a square, so for text-only generation with auto pick the listed ratio that suits the subject (BFL: ultra-wide 21:9/2:1 for panoramas, 16:9 for scenes, 4:5–5:4 for portraits and products, 2:3/3:4 for posters, 9:16 for phone formats).
- Never write aspect ratio or resolution in the prompt text: they are parameters.
- How settings shape the prompt: match the frame (for 21:9 or 2:1 describe elements that span the width; for 9:16 stack the scene vertically). If the ratio differs from the base image in an edit, say what fills the new space. At 768sq keep the prompt to subject, roles and keep list, since fine texture will not show; at 2k/4k concrete surface detail (grain, brush texture, fabric weave) is worth one sentence. Variants (batch_size > 1) differ on their own because there is no seed; do not ask for variety in the text.

## Checklist

- [ ] Viewed every reference; each has one stated role; base image is image 1 where possible; medias in label order with role `image_references`.
- [ ] Every @N replaced by "image N" plus role, same wording throughout; relations between images described.
- [ ] Style refs limited to medium, texture, palette, light, with their subjects named and kept out.
- [ ] Edits: unambiguous target, one change, full keep list.
- [ ] Positive description first, at most one short exclusion line; no quality tags; text quoted and placed.
- [ ] `resolution` passed unchanged, `batch_size` = count, aspect ratio from the request; none of them in the text.

## Sources

- BFL docs index: https://docs.bfl.ai/llms.txt
- FLUX 3 Image overview: https://docs.bfl.ml/flux_3/flux3_image_overview.md
- FLUX 3 Text to Image: https://docs.bfl.ml/flux_3/flux3_image_generate.md
- FLUX 3 Image Editing: https://docs.bfl.ml/flux_3/flux3_image_layout.md
- Bounding boxes with FLUX 3 Image: https://docs.bfl.ml/flux_3/flux3_image_bounding_boxes.md
- Prompting Basics (FLUX 3 Image): https://docs.bfl.ml/guides/prompting_unified_basics.md
- Building a Good Prompt: https://docs.bfl.ml/guides/prompting_unified_building.md
- Style, Aesthetics & Text: https://docs.bfl.ml/guides/prompting_unified_style.md
- Technical Parameters (aspect ratio, resolution, no negative prompt): https://docs.bfl.ml/guides/prompting_unified_technical.md
- Single-Reference Editing: https://docs.bfl.ml/guides/prompting_editing_single_reference.md
- Multi-Reference Editing: https://docs.bfl.ml/guides/prompting_editing_multi_reference.md
- FLUX.2 JSON / HEX prompting (borrowed, FLUX.2 only): https://docs.bfl.ml/guides/usecases_t2i_json_prompting.md, https://docs.bfl.ml/guides/usecases_t2i_hex_color_prompting.md
- FLUX 3 announcement (July 23, 2026): https://bfl.ai/blog/flux-3
- Higgsfield FLUX 3 post: https://higgsfield.ai/blog/flux-3-higgsfield (model parameters taken from Higgsfield `models_explore`)
