# Prompt guide: GPT Image 2.5 (`gpt_image_2_5`)

You are rewriting the user's short brief into the prompt GPT Image 2.5 (OpenAI, image) will receive. Write the final prompt in English; keep any text that must appear in the image verbatim, in quotes.

## What the model is

- Strengths: precise instruction following, very strong in-image text and typography, precise local edits of one small element, new camera views of the same place, product and prop shots, transparent backgrounds.
- Weaknesses: tends to touch the whole image during an edit (colour shifts, re-rendered textures), so it needs an exhaustive preserve list; character consistency across separate generations varies; precise placement in dense layouts is hard.
- Results go wrong when: a reference has no stated role (it gets blended in, subjects included), the edit target is vague, or quality is left at Higgsfield's default `low`.

## Before you write

1. View every reference file (Read its uploadPath) and note what each shows, so you can name what must not be copied.
2. Give each reference one role from the brief: base, subject, location, style, object, mood. "Edit @N" makes @N the base; when ambiguous, @1 is the base.

## References

- Higgsfield media role: `image_references`. Several allowed (keep to about 10; fewer is more precise).
- Pass media ids in `medias` in label order (@1 first…), each with role `image_references`. The model reads them as "image 1", "image 2"… in that order.
- Replace every @N in the prompt with "image N" plus its role.

## Prompt structure

- Labelled sections are the format OpenAI recommends and they can be sent as is: `REFERENCES`, `CHANGE` / `PRESERVE` / `CONSTRAINTS` for edits; `REFERENCES`, `SUBJECT`, `SETTING`, `LIGHT`, `STYLE`, `CONSTRAINTS` for generation. Plain sentences inside each section.
- 60–180 words. Concrete visible facts (medium, materials, colours, light position), not mood adjectives. No "masterpiece, 8k". No aspect ratio or resolution in the text.
- Unlike Nano Banana Pro, explicit negations work well here: a short `CONSTRAINTS` line such as "No people, no added objects, no text, no border, no watermark." Keep it to things that could actually appear.

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
SUBJECT: The man from image 1 stands on the right third, looking at a potted lemon tree.
LIGHT: Late-afternoon sun through the glass roof from the left, warm highlights on his shoulders.
PRESERVE: His identity, proportions and clothing exactly as in image 1; the greenhouse architecture as in image 2.
CONSTRAINTS: No other people.
```

## Pattern (c): local edit, change one thing

```
CHANGE: Change only the mug on the desk in image 1 from white to matte black ceramic, same shape and position.
PRESERVE: Everything else exactly: desk, laptop, papers, hands, wall, window light, shadows, colours, grain, camera angle.
CONSTRAINTS: Do not re-render or recolour any other area.
```

The smaller the change, the cleaner the result. One change per prompt.

## Pattern (d): text generation plus mood references

```
REFERENCES: Images 1 and 2 are mood references only: their muted green-grey palette, soft fog and quiet stillness.
SUBJECT: An abandoned railway platform in a pine forest, a single wooden bench, rails disappearing into fog.
LIGHT: Diffuse overcast light from above, fog brightening toward the vanishing point.
STYLE: Photograph, 35mm, natural colour.
CONSTRAINTS: Do not copy the subjects or composition of images 1 and 2. No people, no text.
```

## Preservation language

- "Image 1 is the only source of content and composition."
- "Keep image 1's framing, horizon, element positions and light direction exactly."
- "Images N and M provide only brushwork, texture and palette; do not copy their subjects, figures, objects or layout." Name those subjects explicitly in CONSTRAINTS.
- Restate the full preserve list every time; "same as before" is not enough.

## Parameters

- `variant`: `sunburst` for edits and final images (better preservation and precision); `flare` only for cheap exploration. Use `sunburst`.
- `quality`: low (Higgsfield default), medium, high, xhigh, max. Always set it; use `high`.
- `resolution`: 1k (default), 2k, 4k. Use `2k`.
- `aspect_ratio`: auto, 1:1, 3:2, 2:3, 4:3, 3:4, 16:9, 9:16, 21:9, 27:16, 16:27, 9:8, 8:9, 4:5, 5:4. Use the request's; for edits with auto, `auto` keeps image 1's shape.
- `background`: omit, or `transparent` for a cut-out object.
- Count: the request's number of variants.

## Checklist

- [ ] References viewed; each has one stated role; medias in label order with role `image_references`.
- [ ] Style refs limited to brushwork, texture, palette, with their subjects named in CONSTRAINTS.
- [ ] Exhaustive PRESERVE list for any edit; one change only.
- [ ] `variant: sunburst`, `quality: high`, `resolution: 2k` set explicitly.
- [ ] Exact text in quotes; English; 60–180 words.
