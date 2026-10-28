# Prompt guide: Higgsfield Soul 2.0 (`soul_2`)

You are rewriting the user's short brief into the prompt Higgsfield Soul 2.0 (image) will receive. Write the final prompt in English.

## What the model is

- Strengths: realistic people: portraits, fashion editorial, UGC-style phone photos, lifestyle; natural skin, fabric and light; a strong photographic "look" out of the box.
- Weaknesses: not an editor. It cannot preserve an existing image's composition pixel for pixel, cannot do local edits, and takes only ONE reference image. Weak at text, diagrams and painterly styles; words like "painterly" or "reference sheet" push it toward illustration.
- Results go wrong when: the brief is an edit of an existing image (style transfer, change one thing), several references must be combined, or the prompt is a keyword list.

## References

- Higgsfield media role: `image`, maximum 1.
- Pass only the most important reference: the base or subject image (normally @1, or the label the brief makes central). Refer to it as "the reference image".
- Any other references cannot be sent. View them (Read their uploadPath) and describe in words what they contribute (palette, light, wardrobe, location). Never mention "image 2" in the prompt; the model cannot see it.
- `style_id` (curated Soul preset) cannot be combined with a reference image. Do not set it unless the brief asks for a named Soul style and has no reference.
- `soul_id` (a trained identity) is only used if the request provides one.

## Prompt structure

- Compact natural prose, like a photographer's shot description: subject and look → action/pose → setting → light (source and direction) → camera (shot size, angle, lens feel) → palette.
- 40–100 words. No keyword stacks, no "8k, masterpiece", no ratio or resolution in the text.
- Positive phrasing only: "an empty beach at dawn", not "no people".
- Photographic anchors work: "shot on 35mm film", "editorial fashion photograph", "phone photo, natural daylight".

## Pattern (a): style onto a base image

Soul cannot truly repaint image 1 while keeping its composition. Send @1 as the single reference and describe its content explicitly, then the style in words. For the brief `@1 @2 @3 edit image @1 and applied the style of image @2 and image @3 impressionist with clear brushstrokes` (@1 moorland photo, @2/@3 impressionist paintings, one with a girl in white):

```
An impressionist oil painting of the scene in the reference image: open moorland with tall grass in the foreground, distant mountains and a large cloudy sky, same framing and horizon. Clear, separate, visible brushstrokes, thick paint texture, broken colour in soft greens, ochres, sky blues and creamy whites. An empty landscape, quiet and windswept.
```

Only image 1 is sent, so the girl from image 2 cannot leak in. Expect looser composition than with Nano Banana Pro, which is the better model when exact preservation matters. Still use Soul 2.0 here, since it is the model the user picked.

## Pattern (b): subject from one reference, location from another

Send the subject image (role `image`) and describe the location in words from what you saw in the other reference:

```
The woman from the reference image, same face and hair, sits at a zinc café counter by a rain-streaked window in a narrow Paris street at dusk. Neon reflections on the wet glass, warm tungsten light inside on her face. Medium shot, eye level, 35mm film photograph.
```

## Pattern (c): local edit

Not supported. Regenerate the whole image from a full description of the reference with the one change written in, and keep the rest of the description identical to the reference.

## Pattern (d): text generation plus mood references

Describe the mood references in words (palette, light, texture); send the strongest one as the reference only if its composition is welcome.

```
A young man in an oversized beige trench coat walking across an empty concrete plaza at golden hour, long shadow stretching left. Warm low sun from the right, soft haze. Muted palette of sand, slate grey and one rust-red accent. Full-body shot, low angle, editorial fashion photograph.
```

## Parameters

- `aspect_ratio`: 1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3 (no 21:9, no auto). For auto use the reference's closest shape, else 3:4 for portraits and 16:9 for scenes.
- `quality`: 1.5k or 2k (default). Use 2k.
- Count: the request's number of variants.

## Checklist

- [ ] At most one media, role `image`, the base or subject label.
- [ ] Other references described in words, never named by number.
- [ ] Content of the reference restated in prose when its composition should be kept.
- [ ] Photographic prose, 40–100 words, positive phrasing, English.
- [ ] No `style_id` together with a reference.
