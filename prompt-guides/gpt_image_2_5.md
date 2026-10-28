# Prompt guide: GPT Image 2.5 (`gpt_image_2_5`)

You are rewriting the user's short brief into the prompt GPT Image 2.5 (OpenAI, image) will receive. Write the final prompt in English; keep any text that must appear in the image verbatim, in quotes.

## What the model is

- OpenAI's newest image model, offered in two variants. **Sunburst** is the base model, built for quality, and goes past GPT Image 2. **Flare** is the small model, built for speed, with quality around GPT Image 2's. Both generate, edit, make transparent backgrounds, and have better precise editing and subject preservation.
- Strengths: close instruction following, strong in-image text and typography, local edits that touch only the named element, keeping a reference subject the same in a new scene or style, product and prop shots, carrying light and camera choices across generations.
- Weaknesses: repeated edits drift (colour, texture, small details), so restate the preserve list every time; tiny or dense text needs higher quality; exact placement in crowded layouts is hard; a region that must stay pixel-identical can't be guaranteed by the prompt.
- Results go wrong when: a reference has no stated role (it gets blended in, subjects included), the edit target is vague, several changes are packed into one edit, or small text is generated at `low` quality.

## Before you write

1. View every reference file (Read its uploadPath) and note what each shows, so you can name what must not be copied.
2. Give each reference one role from the brief: base, subject, location, style, clothing, object, mood. "Edit @N" makes @N the base; when ambiguous, @1 is the base.
3. Decide the job: new image, local edit, style transfer, combine references, transparent cut-out. Pick the matching pattern below.

## References

- Higgsfield media role: `image_references`. Up to 16 allowed; fewer is more precise (about 10 at most in practice).
- Pass media ids in `medias` in label order (@1 first…), each with role `image_references`. The model reads them as "image 1", "image 2"… in that order.
- Replace every @N in the prompt with "image N" plus its role. When combining, say what moves where and what light or style it takes on ("place the lamp from image 2 on the desk in image 1, lit by image 1's window light").

## Prompt structure

- OpenAI accepts any readable format: prose, labelled sections, JSON-like or tags. Use labelled sections, because they are easy to check and send as is: `REFERENCES`, `CHANGE` / `PRESERVE` / `CONSTRAINTS` for edits; `REFERENCES`, `SUBJECT`, `SETTING`, `LIGHT`, `STYLE`, `TEXT`, `CONSTRAINTS` for generation. Use plain sentences inside each section and leave out sections you don't need.
- 60–180 words. Use concrete, visible facts: the use (product photo, poster, film still), medium, materials, colours, light source and direction, framing, placement. Avoid mood adjectives. Say "photorealistic" or "a real photograph" when you want that. Treat lens and film terms as looks, not exact optics. No "masterpiece, 8k".
- People: give the framing ("full body visible", "waist-up"), relative scale, gaze, and how the hands hold or touch objects.
- Text: put the exact wording in quotes and give its placement, size, and typeface style. Spell rare words letter by letter if needed. Say how many times it appears and add "no extra text".
- Explicit negations work well here. Add a short `CONSTRAINTS` line such as "No people, no added objects, no extra text, no logos, no watermark." Keep it to things that could actually appear.
- Never put aspect ratio, resolution, or pixel size in the prompt text. Those are parameters (see Settings).

## Settings (`request.resolvedOptions`)

The user's per-model choices arrive in `request.resolvedOptions` as `{ variant, quality, resolution, background }`. Pass them to Higgsfield **unchanged**. Never override, "upgrade", or fill them in yourself.

- `variant`: `flare` | `sunburst` (Higgsfield default `flare`).
- `quality`: `low` | `medium` | `high` | `xhigh` | `max` (Higgsfield default `low`).
- `resolution`: `1k` | `2k` | `4k` (default `1k`).
- `background`: `auto` | `opaque` | `transparent`. **Omit the param** when the option is missing or null, so the model default applies.
- `aspect_ratio`: the request's (auto, 1:1, 3:2, 2:3, 4:3, 3:4, 16:9, 9:16, 21:9, 27:16, 16:27, 9:8, 8:9, 4:5, 5:4). For edits with `auto`, image 1's shape is kept.
- Count: the request's number of variants.

How the settings change the prompt:

- `background: transparent`: write an isolated cut-out. Describe the subject alone, with clean, crisp edges (say so for hair, fur, glass, and thin parts), and no floor, ground shadow, reflection, backdrop, or scene. Ask for "a transparent background" in the prompt too, as OpenAI recommends asking in both the prompt and the parameter. Never write "white background", "studio backdrop", or "checkerboard", since a drawn checkerboard is not real transparency. For an edit, add "preserve the product's geometry and label text exactly; do not restyle it".
- `background: opaque`: describe a full background or scene; don't describe the subject as a cut-out.
- `quality` is `low`/`medium` and the image has small or dense text: keep the text short and large, and spell it out exactly.

Notes for the user (only as remarks in your progress report, never by changing options):

- Recommend **Sunburst** for final images, precise local edits, multi-step edits where earlier changes must hold, identity or product preservation, and dense text. **Flare** is right for fast exploration, volume, and everyday images.
- Recommend `high` or above when the result needs small text, labels, fine detail, or a clean edit. OpenAI's advice is to raise quality only when the output falls short, and to use `xhigh`/`max` only when they fix a concrete problem, since they cost more time and credits.
- `2k`/`4k` add pixels, not more control; recommend them for final delivery, not exploration.

## Pattern (a): style transfer onto a base image

Brief: `@1 @2 @3 edit image @1 and applied the style of image @2 and image @3 impressionist with clear brushstrokes` (@1 moorland photo; @2 impressionist girl in a white dress running through grass; @3 impressionist flower field, blue sky). A prompt that only says "apply the style of image 2 and 3" lets the girl from image 2 appear. Write:

```
REFERENCES: Image 1 is the base: a photograph of open moorland, grass, distant mountains and a cloudy sky. Images 2 and 3 are style references only.
CHANGE: Repaint image 1 as an impressionist oil painting with clear, separate, visible brushstrokes, thick paint texture and broken colour, using the light palette of images 2 and 3.
PRESERVE: Image 1's exact composition, framing, horizon line, mountain silhouettes, cloud shapes, terrain and light direction.
CONSTRAINTS: Take only brushwork, texture and palette from images 2 and 3. No people, no girl, no white dress, no added flowers, no objects or layout from images 2 or 3.
```

## Pattern (b): subject from one reference, location from another

```
REFERENCES: Image 1 is the subject: the old man, his face, beard, grey cardigan and walking stick. Image 2 is the location: the sunlit greenhouse with white iron arches.
SUBJECT: The man from image 1, full body visible, stands on the right third, looking at a potted lemon tree, one hand resting on his walking stick.
LIGHT: Late-afternoon sun through the glass roof from the left, warm highlights on his shoulders, matching image 2's light.
PRESERVE: His face, skin tone, proportions, hairstyle and clothing exactly as in image 1; the greenhouse architecture as in image 2.
CONSTRAINTS: No other people, no added accessories.
```

## Pattern (c): local edit, change one thing

```
CHANGE: Change only the mug on the desk in image 1 from white to matte black ceramic, same shape, size and position.
PRESERVE: Everything else exactly: desk, laptop, papers, hands, wall, window light, shadows, colours, saturation, contrast, grain, camera angle.
CONSTRAINTS: Do not re-render or recolour any other area. Do not change anything else.
```

The smaller the change, the cleaner the result. Make one change per prompt. To remove an object, name it and where it is, then preserve everything else.

## Pattern (d): generation with text plus mood references

```
REFERENCES: Images 1 and 2 are mood references only: their muted green-grey palette, soft fog and quiet stillness.
SUBJECT: An abandoned railway platform in a pine forest, a single wooden bench, rails disappearing into fog. A weathered enamel station sign above the bench reads "NORDHEIM" in white capital sans-serif letters on dark green.
LIGHT: Diffuse overcast light from above, fog brightening toward the vanishing point.
STYLE: A real photograph, 35mm look, natural colour.
CONSTRAINTS: Do not copy the subjects or composition of images 1 and 2. The sign text appears once; no other text, no people, no logos.
```

## Pattern (e): transparent cut-out (`background: transparent`)

```
REFERENCES: Image 1 is the product: the amber glass perfume bottle with a brass cap and a cream label reading "AURA".
SUBJECT: The bottle from image 1 alone, upright, three-quarter view, isolated on a transparent background.
PRESERVE: Its exact shape, proportions, glass colour, cap and label text.
CONSTRAINTS: Clean, crisp alpha edges around the glass and cap. No floor, no shadow, no reflection, no backdrop, no props, no checkerboard. Do not restyle the bottle.
```

## Preservation language

- "Image 1 is the only source of content and composition."
- "Keep image 1's framing, horizon, element positions and light direction exactly."
- "Images N and M provide only brushwork, texture and palette; do not copy their subjects, figures, objects or layout." Name those subjects explicitly in CONSTRAINTS.
- For people, list face, skin tone, body shape, pose, hairstyle, background and camera angle, then allow only the target item to change.
- Restate the full preserve list every time; "same as before" drifts.

## Checklist

- [ ] References viewed; each has one stated role; medias in label order with role `image_references`.
- [ ] Style references limited to brushwork, texture and palette, with their subjects named in CONSTRAINTS.
- [ ] Exhaustive PRESERVE list for any edit; one change only.
- [ ] `request.resolvedOptions` passed unchanged; `background` omitted when not set; no aspect ratio or resolution in the text.
- [ ] Transparent background: isolated subject, clean edges, no floor, shadow or scene, no "white background".
- [ ] Exact text in quotes, with placement and "no extra text"; English; 60–180 words.

## Sources

- OpenAI, Image prompting guide (GPT Image 2.5 Flare/Sunburst): https://developers.openai.com/api/docs/guides/image-prompting.md
- Higgsfield, GPT Image 2.5 on Higgsfield (Flare vs Sunburst, settings): https://higgsfield.ai/blog/gpt-image-2-5-higgsfield
- Higgsfield `models_explore` for `gpt_image_2_5` (params, aspect ratios, media role).
