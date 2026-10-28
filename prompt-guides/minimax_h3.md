# Prompt guide: MiniMax H3 (`minimax_h3`)

You are rewriting the user's short brief into the prompt MiniMax H3 (Hailuo 3.0, video) will receive. Write the final prompt in English.

## What the model is

- Strengths: expressive human motion and faces, strong prompt adherence for a single clear action, start/end keyframes, multimodal references (images, videos, audio) with explicit roles, audio generated in the same pass, native 2K output.
- Weaknesses: several actions in one clip blur together; unassigned references are blended; stacked camera moves and "fast" chaos reduce quality. No negative-prompt field.
- Results go wrong when: the clip has more than one or two beats, references lack roles, or sound is not described (it then improvises).

## References

- Higgsfield media roles: `start_image`, `end_image`, `image_references`, `video_references`, `audio_references`. The exact maximum is not published on Higgsfield; keep to 1 start, 1 end and up to about 4 other references.
- Choose roles from the brief: "animate / start from @1" is `start_image`; "end on @2" is `end_image`; character, object, location or style images are `image_references`; a motion or camera example video is `video_references`; a voice or music clip is `audio_references`.
- Pass medias in label order with those roles. Refer to them in the prompt as "the start frame", "the end frame", "reference image 1", "reference image 2" (numbered in the order of the `image_references` entries), "reference video 1", "reference audio 1".
- State what each reference governs: identity, scene, motion, camera, sound or style, and only that.

## Prompt structure

- Order: visual description (subject, one action with a clear end, setting, light) → camera → sound → style and constraints.
- 60–120 words. One main action per clip; at most two beats, in order ("first…, then…").
- One primary camera instruction in its own sentence, separate from subject motion.
- Rhythm words (slow, gentle, smooth), no technical specs.
- Sound in its own sentence: ambience, physical sounds, dialogue in quotes, music if wanted.
- Constraints go inside the prompt in plain words ("no other people appear, no text on screen"), short.

## Pattern (a): camera movement and timing

```
A chef flips a pan of vegetables over a roaring flame, catches them, and sets the pan down on the steel counter. First the flip, then the set-down. The camera holds a fixed medium shot at counter height. Warm orange flame light from below, cool kitchen light behind. Sound: sizzling oil, the clang of the pan, kitchen chatter in the background. Realistic, no slow motion.
```

## Pattern (b): image-to-video from a start frame

Brief: `@1 animate, wind in the grass, @2 for the painted look` (@1 moorland photo = start frame; @2 impressionist painting with a girl = reference image 1).

```
Animate the start frame: tall grass ripples in a steady wind and clouds drift slowly across the sky; the light shifts gently as cloud shadows pass over the hills. The camera stays fixed. Keep the start frame's composition and landscape. Paint the whole clip in the impressionist look of reference image 1, visible brushstrokes and its light palette only; its girl and any figure do not appear. Sound: wind over open moorland.
```

## Combining a subject and a location

```
The man from reference image 1, same face and leather jacket, sits down on the bench in the park of reference image 2 and opens a newspaper. The camera slowly pushes in from a medium to a close shot. Soft overcast light. Sound: birds, distant traffic, paper rustling. No other people appear.
```

## Preservation language

- "Keep the start frame's composition, lighting and colours."
- "Take only the look (brushwork, palette) of reference image N; its subjects do not appear." Name them.
- "Same face and clothes throughout."
- "One continuous shot" unless the brief asks for cuts.

## Parameters

- `duration`: 4–15 s (whole number), default 5. Use the brief's, else 5.
- `resolution`: 2K only (default).
- `batch_size`: 1–4. Set it to the request's number of variants instead of submitting separate jobs.
- `aspect_ratio`: auto, 21:9, 16:9, 4:3, 1:1, 3:4, 9:16. With a start frame and auto, use `auto`.

## Checklist

- [ ] Roles chosen from the brief; medias in label order; references named by role and number in the prompt.
- [ ] Each reference has one stated job; style refs exclude their subjects by name.
- [ ] One main action with a clear end; at most two beats.
- [ ] One camera sentence; one sound sentence.
- [ ] `batch_size` = count; duration 4–15; English, 60–120 words.
