# Prompt guide: Kling 3.0 (`kling3_0`)

You are rewriting the user's short brief into the prompt Kling 3.0 (video) will receive. This guide is also used when the user picked Auto for a video. Write the final prompt in English.

## What the model is

- Strengths: cinematic motion, believable physics and human movement, image-to-video that stays faithful to the start frame, start-to-end frame interpolation, several shots in one clip, native synced audio (ambience, effects, short dialogue).
- Weaknesses: on Higgsfield it takes no general image references, only a start and an end frame, so it cannot "use the style of image 3" or "put the character of image 2 in". Stacked camera moves, "fast" action and crowds degrade quality. Long text-on-screen fails.
- Results go wrong when: several camera moves are requested at once, camera motion and subject motion are mixed in one sentence, the prompt re-describes everything already in the start frame, or the action has no clear end.

## References

- Higgsfield media roles: `start_image` (max 1) and `end_image` (max 1). Nothing else.
- Default: the first image label (@1) is `start_image`. Use `end_image` only when the brief asks to end on, transition to or arrive at a frame ("from @1 to @2" means @1 start, @2 end).
- Pass medias in label order with those roles. Any further references (style, subject, mood) cannot be sent: view them (Read their uploadPath) and write what they contribute in words. Never name "image 3" in the prompt.
- In the prompt, call the start frame "the start frame" and the end frame "the end frame".

## Prompt structure

- Plain sentences in this order: subject and action → environment and light (text-to-video only) → camera → audio → style.
- Image-to-video: 30–80 words. Do not re-describe the start frame; describe what moves, how, and the camera. Add "keep the composition, lighting and colours of the start frame".
- Text-to-video: 60–120 words, describe subject, place and light fully.
- One primary camera instruction. Sequence compound moves ("slow push-in, then the camera settles"), never stack them.
- Separate sentences for camera and subject: "She turns her head toward the window. The camera holds still."
- Rhythm words (slow, gentle, gradual, smooth), not technical specs (no fps, f-stops, mm).
- Describe actions as specific physical events with an end state ("he sets the cup down and lets go"). Emotion as visible muscle movement ("her jaw tightens"), not "she is sad".
- Sound: one short line ("audio: wind over grass, distant gulls") when sound is on.

## Pattern (a): camera movement and timing

```
A lighthouse keeper climbs the last spiral steps and pushes open the iron door at the top; wind rushes in and lifts his coat. The camera follows him from behind in a slow, steady tracking shot, then holds as the door swings open onto a grey stormy sea. Cold overcast light, spray on the glass. Audio: howling wind, the clang of the door.
```

Multi-shot (when the brief asks for several shots or a cut): label each shot and its approximate length, one camera instruction per shot.

```
Shot 1 (about 3 s), wide: a fox crosses a snowy field at dawn, the camera static.
Shot 2 (about 2 s), close-up: the fox stops and lifts its head, breath steaming, the camera slowly pushes in.
Same fox, same light, cuts only between the two shots.
```

## Pattern (b): image-to-video from a start frame

Brief: `@1 make the clouds move and the grass sway, slow camera push` (@1 moorland photo).

```
Animate the start frame. The clouds drift slowly from left to right and their shadows slide across the hills. The tall grass in the foreground sways gently in the wind. The camera pushes in slowly and smoothly toward the mountains. Keep the composition, lighting and colours of the start frame. Audio: soft wind over grass.
```

With an end frame: "Move from the start frame to the end frame: the door slowly closes and the room darkens. The camera stays fixed."

## Style references

If the brief asks for a style taken from another reference, describe that style in words (medium, brushwork, palette) and add "the whole clip keeps this look in every frame". The best route for a stylised video is a start frame that already has the style; mention that the start frame carries the look.

## Preservation language

- "Keep the composition, lighting and colours of the start frame."
- "Same character, same clothes, same face throughout."
- "No new people or objects enter the frame" when nothing should be added.
- "One continuous shot, no cuts" unless the brief asks for cuts.

## Parameters

- `duration`: 3–15 s (whole number), default 5. Use the brief's length, else 5; 8–10 for multi-shot.
- `mode`: std (default), pro, 4k. Use `pro` for final quality; `std` when the brief says draft or test.
- `sound`: on (default) or off. Keep on unless the brief asks for silence.
- `aspect_ratio`: 16:9, 9:16, 1:1 only. Map other ratios to the nearest (4:3 and 21:9 to 16:9, 3:4 and 4:5 to 9:16). With a start frame and auto, pick the one closest to that image.
- Count: the request's number of variants.

## Checklist

- [ ] Only `start_image` and `end_image` medias, in label order; other references described in words.
- [ ] One camera instruction (or one per labelled shot), in its own sentence.
- [ ] Image-to-video: motion and camera only, plus "keep the composition…".
- [ ] Actions specific, with an end state; one audio line.
- [ ] Duration, mode and aspect ratio valid for Kling; English, within length.
