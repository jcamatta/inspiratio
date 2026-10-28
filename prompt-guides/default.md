# Prompt guide: any other model (fallback)

No dedicated guide exists for the selected model. Follow these general rules. Write the final prompt in English; keep in-image text verbatim, in quotes.

## First, check the model

- Call higgsfield `models_explore` with `action: "get"` and the model id once, to learn its media roles (and any max), aspect ratios and parameters. Use only the roles and values it lists.
- If the model is unknown, fall back to `nano_banana_pro` for images or `kling3_0` for videos and use those guides' rules.

## Before you write

1. View every reference file (Read its uploadPath) and note in a few words what each shows.
2. Give each reference one role from the brief: base (content and composition), subject, location, style (brushwork, texture, palette), mood, start frame, end frame, motion. "Edit @N" makes @N the base; when ambiguous, @1 is the base or start frame.

## References

- Pass media ids in `medias` in label order (@1 first…), each with a role the model accepts: usually `image_references` for image models; `start_image` / `end_image` / `image_references` / `video_references` for video models.
- If the model accepts fewer references than the brief has, send the most important (base or subject, else @1) and describe the others in words; never name a reference number the model will not receive.
- In the prompt, replace each @N with "image N" plus its role ("image 1, the landscape photo"). Numbering follows the medias order.

## Prompt structure

- Natural, complete sentences. No keyword stacks, no quality words ("masterpiece, 8k"), no aspect ratio or resolution in the text.
- Images: 60–150 words. Subject → setting → light (name source and direction) → palette and medium → framing → reference roles.
- Edits: what image 1 is → the one change → what stays exactly the same.
- Videos: 50–100 words. Subject and action with a clear end → camera (one instruction, its own sentence) → light → sound. Image-to-video: describe motion and camera only, plus "keep the composition, lighting and colours of the start frame".

## Style transfer (the common failure)

When the brief says "edit @1 with the style of @2 and @3", a vague prompt lets the subjects of @2/@3 appear in the result. Always write:

```
Image 1 is the only source of content and composition: keep its scene, framing, horizon and light direction. Images 2 and 3 are style references only: take their brushwork, paint texture and palette, not their subjects, figures, objects or layout. Add nothing that is not in image 1: no [name the subjects you saw in images 2 and 3].
```

## Other patterns

- Subject plus location: "The [subject] from image 1, same face and clothes, in the [place] of image 2. [Position, action, light matching image 2]."
- Local edit: "Change only [one thing]. Keep everything else exactly as in image 1: [list the main elements, camera angle, light, colours]."
- Text plus mood references: describe the scene fully, then "use the palette and atmosphere of images N and M, not their subjects or composition."

## Parameters

- Use the request's aspect ratio when the model lists it; otherwise the nearest listed one (for edits and start frames, the one closest to image 1's shape, or `auto` if listed).
- Leave quality/resolution at a sensible high-but-not-max value (2k for images, 720p–1080p for video) when the parameter exists and the default is low.
- Duration for video: the brief's, else 5 s, within the model's range.
- Count: the request's number of variants.

## Checklist

- [ ] Model checked with `models_explore`; only listed roles and values used.
- [ ] References viewed; each has one role; medias in label order.
- [ ] Style references limited to brushwork, texture, palette, with their subjects excluded by name.
- [ ] One change per edit; one camera move per video shot.
- [ ] Natural sentences, English, within length.
