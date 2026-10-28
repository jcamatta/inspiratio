# Prompt guide: Seedream 4.5 (`seedream_v4_5`)

You are rewriting the user's short brief into the prompt Seedream 4.5 (ByteDance, image) will receive. Write the final prompt in English; keep in-image text verbatim, in quotes.

Model id: `seedream_v4_5`.

## What the model is

- Strengths: very high resolution (up to ~6K), rich realistic textures (skin pores, fabric weave, stone, foliage), strong at reviving flat or "AI-smooth" surfaces, good multi-reference composition, solid style transformations of a whole image, good text.
- Weaknesses: weaker than Nano Banana Pro at small surgical edits (it tends to re-render the whole frame), drifts when the prompt is long and contradictory, and copies subjects from references whose role is not stated.
- Results go wrong when: a point edit is asked in vague words, many changes are combined, or style references contain figures and the prompt does not exclude them.

## Before you write

1. View every reference (Read its uploadPath) and note what each shows.
2. Give each one role from the brief: base, subject, location, style, mood. "Edit @N" makes @N the base; when ambiguous, @1 is the base.

## References

- Higgsfield media role: `image_references`. Up to about 10 references work; 2–4 give the most predictable results.
- Pass media ids in `medias` in label order (@1 first…), each with role `image_references`. Refer to them as "image 1", "image 2"… in that order.
- Always map each image to what it contributes ("the woman from image 1, the kitchen from image 2").

## Prompt structure

- Short, clear natural sentences: subject + action + setting + light + style. For edits: action + target + attribute ("change the coat to dark green wool").
- 30–100 words. Shorter than for Nano Banana Pro: Seedream loses focus on long prompts. No keyword stacks, no ratio or resolution in the text.
- Name materials and finishes concretely ("weathered oak, matte linen, wet slate").
- Positive phrasing first; one short exclusion sentence is fine for style references.

## Pattern (a): style transfer onto a base image

Brief: `@1 @2 @3 edit image @1 and applied the style of image @2 and image @3 impressionist with clear brushstrokes` (@1 moorland photo; @2 impressionist girl in white dress; @3 impressionist flower field). Bad: "apply the style of image 2 and image 3" (the girl appears). Good:

```
Turn image 1, a photo of moorland with grass, mountains and a cloudy sky, into an impressionist oil painting. Keep image 1's exact composition, horizon, mountains and clouds. From images 2 and 3 take only the visible separate brushstrokes, thick paint texture and light palette. Add no people and nothing from images 2 or 3: no girl, no white dress, no flowers. The scene stays an empty landscape.
```

## Pattern (b): subject from one reference, location from another

```
The cyclist from image 1, same face, helmet and yellow jersey, rides along the coastal cliff road of image 2. Morning sun from the right, long shadows across the asphalt, sea glittering below. Keep the road and cliffs as in image 2. Realistic photo, eye level.
```

## Pattern (c): local edit or texture pass

Seedream is best used here for a whole-surface change, not a tiny object. For a texture revival:

```
Revive the textures of image 1: natural skin with fine pores, visible wool weave on the sweater, grain in the wooden table. Keep the composition, face, pose, lighting and colour grade of image 1 exactly.
```

For a single-object change keep it short and explicit: "Change only the red door in image 1 to deep blue; keep everything else unchanged."

## Pattern (d): text generation plus mood references

```
A night market in a narrow alley, steam rising from food stalls, paper lanterns overhead. Warm lantern light from above, cool blue shadows. Use the palette and atmosphere of images 1 and 2, not their subjects or layout. Photo, 35mm, shallow depth of field.
```

## Preservation language

- "Keep image 1's exact composition, framing, horizon and light direction."
- "From images N and M take only brushwork, texture and palette."
- "Add no people or objects from images N and M" and name their subjects ("no girl, no flowers").

## Parameters

- Higgsfield model id: `seedream_v4_5`.
- `quality`: `basic` (default, up to 4K) or `high` (up to ~6K). Use `basic`; `high` only when the brief asks for maximum detail or print.
- `aspect_ratio`: 1:1, 4:3, 16:9, 3:2, 21:9, 3:4, 9:16, 2:3 (no `auto`). Use the request's; for edits with auto, pick the ratio closest to image 1's shape.
- Count: the request's number of variants.

## Checklist

- [ ] Called as `seedream_v4_5`.
- [ ] References viewed and roles stated; medias in label order with role `image_references`.
- [ ] Style refs give only brushwork, texture, palette; their subjects excluded by name.
- [ ] 30–100 words, plain sentences, concrete materials, English.
- [ ] Tiny surgical edits are better on Nano Banana Pro; still do your best with one short, explicit change here.
