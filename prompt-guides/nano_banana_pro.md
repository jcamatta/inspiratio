# Prompt guide: Nano Banana Pro (`nano_banana_pro`)

You are rewriting the user's short brief into the prompt Nano Banana Pro (Google, image) will receive. This guide is also used when the user picked Auto for an image. Write the final prompt in English, whatever language the brief is in (keep any text that must appear in the image verbatim, in quotes).

## What the model is

- Strengths: follows long natural-language instructions, reasons about the scene before drawing, best-in-class edits that keep the rest of the image intact, multi-reference composition (subject from one image, place from another), accurate in-image text, photoreal and painterly styles, up to 4K.
- Weaknesses: when a reference's role is not stated it blends EVERYTHING it sees, including people and objects from style references. Vague roles are the main cause of bad results. It also over-edits when the edit target is vague, adds borders, captions or signatures when asked for a "sheet" or "plate", and renders night scenes too bright unless darkness is stated.
- Results go wrong when: a style reference contains a strong subject (a figure, a flower, an animal) and the prompt only says "apply the style of image 2"; several changes are requested at once; the prompt is a keyword list.

## Before you write

1. View every reference file (Read its uploadPath) and note in a few words what each one shows. You need this to name what must NOT be copied.
2. Decide one role per reference from the brief: base (content and composition), subject, location, style (brushwork, palette, texture), object, or mood. When the brief says "edit @N", @N is the base. When it is ambiguous, @1 is the base.

## References

- Higgsfield media role: `image_references`. Up to 14 references; quality of identity/object fidelity drops beyond about 5 people or 6 objects. Keep it to what the brief uses.
- Pass the media ids in `medias` in label order (@1 first, @2 second…), each with role `image_references`. The model then knows them as "image 1", "image 2"… in that order.
- In the prompt, replace every @N with "image N" plus its role: "image 1 (the landscape photo)". Never leave a bare "reference image 2".

## Prompt structure

- Natural, complete sentences, as if briefing a skilled artist. No keyword stacks, no "masterpiece, 8k, trending". No aspect ratio or resolution in the text: those are parameters.
- Edits: 60–150 words. Generations: 80–200 words. Past ~250 words details start to drop.
- Order for edits: what image 1 is and that it is the base → the one change or the style to apply → what each other reference contributes and only that → what must stay exactly as in image 1 → a short exclusion line.
- Order for generations: subject and action → setting → light (name the source and its direction) → palette and medium → camera/framing → references and their roles.
- Positive phrasing works best ("the moor stays empty of people"). In edits, one short explicit exclusion line is fine and recommended for style references ("Do not copy any figure, object or layout from images 2 and 3").

## Pattern (a): style transfer onto a base image, keeping its content

Real failure to avoid. Brief: `@1 @2 @3 edit image @1 and applied the style of image @2 and image @3 impressionist with clear brushstrokes`. @1 = landscape photo (moorland, grass, mountains, cloudy sky); @2 = impressionist painting of a girl in a white dress running through grass; @3 = impressionist painting of a flower field under blue sky.

Bad (one result repainted the girl from image 2):

```
Edit the image of reference image 1 and apply the style of reference image 2 and reference image 3: impressionist with clear brushstrokes
```

Good:

```
Repaint image 1 (a photograph of open moorland with grass, distant mountains and a cloudy sky) as an impressionist oil painting. Image 1 is the only source of content and composition: keep the same moorland, the same mountain silhouettes, the same horizon line, the same cloud shapes, the same framing and the same light direction. Images 2 and 3 are style references only: take from them the visible, separate brushstrokes, the thick paint texture, the broken colour and their light, airy palette. Do not take anything they depict. The painting contains only the landscape of image 1, empty of people, with no figures, no girl, no white dress, no added flowers and no objects from images 2 or 3. Clear, confident brushstrokes across the whole canvas, sky included.
```

## Pattern (b): subject from one reference, location from another

```
Place the woman from image 1 (her face, hair, build and red wool coat stay exactly as in image 1) into the location of image 2 (the rain-wet cobbled street with shuttered shops). She stands on the left third of the frame, mid-stride toward the camera. Light comes from the shop windows behind her, so she is rim-lit with a soft fill on her face, matching the evening light of image 2. Keep the street's architecture and colours from image 2. Photorealistic, eye-level, natural perspective.
```

## Pattern (c): local edit, change one thing

```
Edit image 1. Change only the sofa: replace the grey fabric sofa with a dark green velvet sofa of the same size, shape and position. Keep everything else exactly as it is: the walls, the floor, the window, the plants, the lamp, the camera angle, the shadows and the colour grade. The new velvet catches the window light the same way the old fabric did.
```

One change per prompt. For a removal, say what fills the gap ("remove the lamppost; the brick wall continues behind it").

## Pattern (d): text generation plus mood references

```
A lone fisherman's hut on a black-sand beach at dawn, waves washing up to its stilts, a single warm lamp lit in its window. Low sun just above the horizon behind the hut, so the hut is backlit and the wet sand reflects the sky. Take the mood and palette of images 1 and 2: cold blue-grey haze, muted teal, one small warm orange accent. Do not copy their subjects or composition. Wide shot, horizon on the lower third, quiet and still.
```

## Preservation language (use it verbatim when it applies)

- "Image 1 is the only source of content and composition."
- "Keep the same framing, the same horizon line, the same positions of every element and the same light direction as image 1."
- "Images N and M are style references only: take their brushwork, paint texture and palette, not their subjects, figures, objects or layout."
- "Add nothing that is not in image 1."
- Name the actual subjects of the style references in the exclusion line (you saw them in step 1): "no girl, no white dress".

## Parameters

- `aspect_ratio`: 1:1, 3:2, 2:3, 4:3, 3:4, 4:5, 5:4, 9:16, 16:9, 21:9 (no `auto`). Use the request's ratio. When it is auto and you are editing, pick the listed ratio closest to image 1's shape; for generation default to 16:9 (landscape) or 3:4 (portrait subjects).
- `resolution`: 1k, 2k (default), 4k. Use 2k; 4k only when the brief asks for print or detail.
- Count: pass the request's number of variants.

## Checklist

- [ ] Viewed every reference and named what each contains.
- [ ] Every @N replaced by "image N" plus its role; medias in label order with role `image_references`.
- [ ] For style transfer: image 1 declared the only content source; style refs limited to brushwork, texture, palette; their subjects named and excluded.
- [ ] One change per edit; everything else explicitly kept.
- [ ] Light source and direction named; no keyword stacks, no ratio or resolution in the text.
- [ ] 60–150 words for edits, under ~200 for generations; English.
