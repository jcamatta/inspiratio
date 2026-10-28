# Prompt guide: Nano Banana Pro (`nano_banana_pro`)

You are rewriting the user's short brief into the prompt Nano Banana Pro (Google Gemini 3 Pro Image) will receive. This guide is also used when the user picked Auto for an image. Write the final prompt in English, whatever language the brief is in. Keep any text that must appear in the image verbatim, in quotes, in its own language. If the brief asks for text in another language, name that language ("the sign reads 'Boulangerie', in French").

## What the model is

- A "thinking" image model: it reasons about the prompt before drawing, so Google's guidance is to describe the scene in full sentences, as you would brief a human artist. Keyword lists ("cool car, neon, night, 8k") lose that advantage.
- Strengths: long, layered instructions; edits that keep the rest of the image intact when told what to keep (semantic masking, no mask needed); multi-reference composition (subject from one image, place from another); legible, styled in-image text and localisation; real-world knowledge (diagrams, infographics, historical eras); studio-style control of lighting, camera angle, focus and colour grade; 1K/2K/4K output.
- Weaknesses (official limitations plus what we have seen): small text, fine details and exact spellings can still fail; character consistency across separate edits varies; complex blends or relighting edits can add artifacts. When a reference's role is not stated it blends everything it sees, people included. It over-edits when the edit target is vague, adds borders, captions or signatures when asked for a "sheet" or "plate", and renders night scenes too bright unless darkness is stated.
- Results go wrong when: a style reference contains a strong subject (a figure, a flower, an animal) and the prompt only says "apply the style of image 2"; several changes are asked for in one edit; the prompt is a keyword list.

## Before you write

1. View every reference file (Read its uploadPath) and note in a few words what each shows. You need this to name what must NOT be copied.
2. Give each reference one role from the brief: base (content and composition), subject/character, location, style (brushwork, palette, texture), object/product, pose, or mood. "Edit @N" makes @N the base. When it is ambiguous, @1 is the base.
3. Read `request.resolvedOptions` (see Settings) and the request's aspect ratio. They change how you frame and how much detail you write.

## References

- Higgsfield media role: `image_references` only. Pass the media ids in `medias` in label order (@1 first, @2 second…), each with role `image_references`. The model then knows them as "image 1", "image 2"… in that order.
- Limits (Gemini API docs): up to 14 references in total, of which up to 6 objects reproduced at high fidelity, up to 5 people kept consistent and up to 3 style references. Higgsfield's own app caps uploads at 8. Send only the references the brief uses. If there are more, merge roles or describe the extras in words.
- In the prompt, replace every @N with "image N" plus its role: "image 1 (the landscape photo)". Never leave a bare "reference image 2".
- Google's own pattern is to state each image's job in one sentence: "Use image 1 for the character's pose, image 2 for the art style and image 3 for the background environment." For people, give each a short distinct label and use it every time ("the woman in the red coat from image 1"). That helps the model keep identities apart.

## Prompt structure

- Start with a strong verb that names the operation: "Repaint…", "Place…", "Edit image 1. Change only…", "Create a poster…".
- Generations (Google's formula): subject → action → location/context → composition (shot type, angle) → style (medium, era, film stock). Then light (name the source and its direction) and the reference roles.
- With references (Google's formula): [reference images and their roles] + [how they relate] + [the new scenario]. Example: "Using the sketch in image 1 as the structure and the fabric in image 2 as the texture, render a high-fidelity 3D armchair in a sun-drenched minimalist living room."
- Edits: what image 1 is and that it is the base → the one change, or the style to apply → what each other reference contributes, and only that → what must stay exactly as in image 1 → one short exclusion line if style references are involved.
- Be concrete. Name materials, not categories ("navy blue tweed jacket", not "suit jacket"). Use camera language ("low angle, shallow depth of field, f/1.8", "wide-angle", "macro") and lighting language ("golden-hour backlight", "three-point softbox", "chiaroscuro"). Give a colour grade or film stock when it matters ("muted teal grade", "1980s colour film, slight grain").
- Positive phrasing first. Google recommends describing what you want ("an empty street") instead of what you don't ("no cars"). In edits a single explicit exclusion line naming the style references' subjects is still worth it, because it prevents the most common failure (see Pattern a).
- Length: edits 60–150 words, generations 80–200 words. Past about 250 words, details start to drop. No "masterpiece, 8k, trending", no "please", no filler.

## Settings (`request.resolvedOptions`)

The user picks per-model settings on the card. For this model `request.resolvedOptions` is `{ resolution }`.

- `resolution`: `1k` | `2k` | `4k`. Pass it to Higgsfield exactly as found in `request.resolvedOptions`. Do not change its case or value, and do not override the user's choice. If it is missing, use `2k` (Higgsfield's default).
- `aspect_ratio`: comes from the request. Allowed values are 1:1, 3:2, 2:3, 4:3, 3:4, 4:5, 5:4, 9:16, 16:9 and 21:9; there is no `auto`. If the request says auto: for an edit, pick the listed ratio closest to image 1's shape; for a generation, use 16:9 for landscapes and 3:4 for portrait subjects.
- Never write the aspect ratio or the resolution in the prompt text ("16:9", "4K", "8k", "ultra HD"). They are parameters. Google's consumer tips put the ratio in the prompt only because the Gemini app has no parameter for it.

How the settings change the prompt:

- At 4k it is worth spending words on fine surface detail the model can now resolve: skin pores and fine hair, fabric weave, paint impasto and bristle marks, wood grain, stone, film grain. At 1k leave micro-texture out and spend the words on composition, light and colour. 2k is the middle.
- In-image text: higher resolution makes small text more legible, but the official limitation still holds. Keep text short, large and few lines. Put the exact words in quotes, describe the typeface ("bold white sans-serif", "flowing brush script"), and give placement and size ("large, top-centre"). For a long or complex text, settle the exact wording first and then put that exact string in the prompt.
- Composition follows the ratio, so describe it in words, not numbers. 21:9 and 16:9: wide, panoramic, horizon placement, the subject on a third, room for negative space. 9:16 and 2:3: vertical, full-height figure or tall architecture, a stacked foreground/middle/background, headline space at the top. 1:1 and 4:5: a centred or tightly framed subject. When the ratio differs from the base image's shape in an edit, say how to fill it ("extend the moorland and sky to the sides").

## Pattern (a): style transfer onto a base image, keeping its content

Real failure to avoid. Brief: `@1 @2 @3 edit image @1 and applied the style of image @2 and image @3 impressionist with clear brushstrokes`. @1 = landscape photo (moorland, grass, mountains, cloudy sky); @2 = impressionist painting of a girl in a white dress running through grass; @3 = impressionist painting of a flower field under blue sky.

Bad (one result repainted the girl from image 2):

```
Edit the image of reference image 1 and apply the style of reference image 2 and reference image 3: impressionist with clear brushstrokes
```

Good:

```
Repaint image 1 (a photograph of open moorland with grass, distant mountains and a cloudy sky) as an impressionist oil painting. Image 1 is the only source of content and composition: keep the same moorland, the same mountain silhouettes, the same horizon line, the same cloud shapes, the same framing and the same light direction. Images 2 and 3 are style references only: take from them the visible, separate brushstrokes, the thick paint texture, the broken colour and their light, airy palette. Do not take anything they depict. The painting contains only the landscape of image 1, an empty moor, with no girl, no white dress, no added flowers and no objects from images 2 or 3. Clear, confident brushstrokes across the whole canvas, sky included.
```

At 4k, add one sentence of surface detail: "Raised impasto ridges and individual bristle marks are visible up close."

## Pattern (b): subject from one reference, location from another

```
Place the woman in the red coat from image 1 into the street of image 2. Keep her face, hair, build and red wool coat exactly as in image 1. Image 2 (a rain-wet cobbled street with shuttered shops) provides the location: keep its architecture and colours. She stands on the left third of the frame, mid-stride toward the camera. Evening light comes from the shop windows behind her, so she is rim-lit with a soft fill on her face, matching image 2. Photorealistic, eye level, 35mm lens, natural perspective, reflections of the windows in the wet cobbles.
```

## Pattern (c): local edit, change one thing

```
Edit image 1. Change only the sofa: replace the grey fabric sofa with a dark green velvet sofa of the same size, shape and position. Keep everything else in the image exactly the same: the walls, the floor, the window, the plants, the lamp, the camera angle, the shadows and the colour grade. The new velvet catches the window light the same way the old fabric did.
```

One change per prompt. To iterate, make a new edit on the result. For a removal, say what fills the gap ("remove the lamppost; the brick wall continues behind it"). For a relight or a time-of-day change ("turn this scene into night"), state the new light sources and how dark it is: "deep night, the only light is the single street lamp, the sky almost black".

## Pattern (d): text-only generation plus mood references

```
Create a quiet dawn scene: a lone fisherman's hut on stilts on a black-sand beach, waves washing up to its legs, a single warm lamp lit in its window. The low sun sits just above the horizon behind the hut, so the hut is backlit and the wet sand mirrors the sky. Images 1 and 2 are mood references only: use their cold blue-grey haze, muted teal and one small warm orange accent, not their subjects or composition. Wide shot, horizon on the lower third, a long empty shoreline, still and silent. Photograph, medium-format film, soft grain.
```

## Pattern (e): in-image text (poster, title card)

```
Create a vertical film poster. A lighthouse on a black basalt cliff in a storm, its beam cutting through heavy rain, waves exploding against the rocks below. Cold blue-grey palette with the warm yellow beam as the only accent; dramatic low angle. At the top centre, the title "THE LAST KEEPER" in large, bold, white condensed sans-serif capitals with generous letter spacing. At the bottom centre, one smaller line, "IN CINEMAS SOON", in the same typeface. No other text, logos or credits.
```

## Preservation language (use it verbatim when it applies)

- "Image 1 is the only source of content and composition."
- "Keep the same framing, the same horizon line, the same positions of every element and the same light direction as image 1."
- "Keep everything else in the image exactly the same." (Google's own edit wording.)
- "Images N and M are style references only: take their brushwork, paint texture and palette, not their subjects, figures, objects or layout."
- "Add nothing that is not in image 1."
- Name the actual subjects of the style references in the exclusion line (you saw them in step 1): "no girl, no white dress".

## Higgsfield call

- `model`: `nano_banana_pro`. `medias`: the reference ids in label order, each with role `image_references`.
- `aspect_ratio`: as in Settings. `resolution`: from `request.resolvedOptions`, unchanged.
- Count: pass the request's number of variants. The model may return fewer images than requested; report what came back.

## Checklist

- [ ] Viewed every reference and named what each contains; at most 6 objects, 5 people and 3 style references.
- [ ] Every @N replaced by "image N" plus its role; medias in label order with role `image_references`.
- [ ] Prompt starts with an operation verb; full sentences; materials, camera and light named concretely.
- [ ] For style transfer: image 1 declared the only content source; style refs limited to brushwork, texture and palette; their subjects named and excluded.
- [ ] One change per edit; "keep everything else exactly the same" plus the main elements listed.
- [ ] Exact in-image text in quotes, with typeface, size and placement; kept short.
- [ ] `resolution` passed from `request.resolvedOptions` unchanged; no ratio or resolution in the text; detail level matched to the resolution.
- [ ] 60–150 words for edits, under ~200 for generations; English.

## Sources

- Google, "Nano Banana Pro image generation in Gemini: Prompt tips": https://blog.google/products-and-platforms/products/gemini/prompting-tips-nano-banana-pro/
- Google, Nano Banana Pro launch post: https://blog.google/innovation-and-ai/products/nano-banana-pro/
- Gemini API, image generation docs (reference limits, editing, text, resolution): https://ai.google.dev/gemini-api/docs/image-generation
- Google Cloud blog, "Ultimate prompting guide for Nano Banana": https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-nano-banana
- Google DeepMind, Gemini image prompt guide: https://deepmind.google/models/gemini-image/prompt-guide/
- Vertex AI, Gemini 3 Pro Image model page and limitations: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-pro-image , https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/gemini-image-generation-limitations
- Higgsfield, Nano Banana Pro prompt guide and help centre: https://higgsfield.ai/nano-banana-pro-prompt-guide , https://higgsfield.ai/creator-hub/help-center/ai-models/how-do-i-use-nano-banana-pro
