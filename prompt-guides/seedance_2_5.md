# Prompt guide: Seedance 2.5 (`seedance_2_5`)

You are rewriting the user's short brief into the prompt Seedance 2.5 (ByteDance, video) will receive. Write the final prompt in English.

## What the model is

- Strengths: multimodal references (images, videos, audio together), character and object identity from reference images, copying camera movement or choreography from a reference video, multi-shot scripts with timecodes, physics-aware motion, native audio, up to 30 s.
- Weaknesses: unclear reference roles make it blend references unpredictably; "fast", "epic", "lots of movement" cause jitter; long contradictory prompts dilute; temporal flicker in long clips.
- Results go wrong when: a reference is named without saying what to take from it, camera and subject motion are mixed, several camera moves are stacked, or actions are not placed in time for clips over 5 s.

## References

- Higgsfield media roles: `start_image`, `end_image`, `image_references` (up to 9 images), `video_references` (up to 3), `audio_references` (up to 3); about 12 in total.
- Choose roles from the brief: "animate @1" or "start from @1" means `start_image`; "end on @2" means `end_image`; a character, object, location or style to reuse means `image_references`; a video to copy motion or camera from means `video_references`.
- Pass medias in label order with those roles. Reference images and videos are numbered by type in that order: the first `image_references` entry is @Image1, the second @Image2; the first video is @Video1.
- Always state what to take from each: "Character appearance from @Image1. Location from @Image2. Camera movement from @Video1 only."
- `mode`: `omni_reference` whenever any media is attached; `t2v` only for a prompt with no media. If the call rejects that combination, retry once with the other mode.

## Prompt structure

- Formula: subject → action → environment and light → camera → style → avoid line.
- Single shot: 60–100 words. Multi-shot: about 60–80 words per shot plus shared constraints. Hard ceiling about 150 words for one shot, 200 for a script.
- One primary camera instruction; sequence compound moves ("low tracking shot, then a subtle rise").
- Camera and subject motion in separate sentences.
- Rhythm words (slow, smooth, gradual), not specs (no fps, f-stops, mm).
- Always one lighting phrase (highest-leverage addition).
- Unlike image models, negative constraints belong here: end with an `Avoid:` line (jitter always; bent limbs for people; temporal flicker for long clips; identity drift when a character is referenced).
- Anchor style to a named tradition ("impressionist oil painting, visible brushstrokes"), not "cinematic" alone.

## Pattern (a): camera movement and timing

Clips over 5 s: place actions with timecodes.

```
[00:00-00:03] Wide shot: a fisherman pushes a wooden boat into a calm grey sea at dawn, water rippling around his boots. The camera is fixed.
[00:03-00:06] Medium shot: he climbs in and takes the oars; the boat drifts out. The camera slowly pulls back.
Soft dawn light from the horizon, mist on the water. Audio: lapping water, creaking oars. Cuts only at the given times.
Avoid: jitter, bent limbs, temporal flicker.
```

## Pattern (b): image-to-video from a start frame

Brief: `@1 animate it in the style of @2` (@1 moorland photo as start; @2 impressionist painting of a girl in white). Start frame = @1 (`start_image`), @2 = `image_references` (@Image1).

```
Animate the start frame: clouds drift slowly to the right and tall grass sways in a gentle wind. The camera pushes in slowly toward the mountains. Keep the start frame's composition and landscape. Render the whole clip as an impressionist oil painting with visible brushstrokes and the light palette of @Image1; take only its brushwork and colours, not its girl or any figure. No people appear.
Avoid: jitter, temporal flicker, new figures.
```

## Combining a subject and a location

```
The woman from @Image1, same face and green coat, walks through the station hall of @Image2 toward the camera. The camera tracks backward smoothly at her pace. Late sun through the high windows behind her. Avoid: identity drift, bent limbs, jitter.
```

## Preservation language

- "Keep the start frame's composition, lighting and colours."
- "Take only the brushwork and palette of @ImageN, not its subjects or layout." Name those subjects.
- "Same character throughout; no new people enter."
- "One continuous shot, no scene cuts" unless the brief asks for cuts.

## Parameters

- `mode`: see References.
- `duration`: 4–30 s (whole number), default 5. Use the brief's, else 5.
- `resolution`: 480p, 720p (default), 1080p. Use 720p; 1080p when the brief asks for final quality; 480p for drafts.
- `generate_audio`: true by default; false when the brief asks for silence.
- `aspect_ratio`: auto, 21:9, 16:9, 4:3, 1:1, 3:4, 9:16. With a start frame and auto, use `auto`.
- Count: the request's number of variants.

## Checklist

- [ ] Roles chosen from the brief; medias in label order; @ImageN numbering follows the order of `image_references` entries.
- [ ] Every reference has a stated contribution; style refs exclude their subjects.
- [ ] `mode` set (omni_reference with media, t2v without).
- [ ] One camera instruction per shot, separate from subject motion; timecodes over 5 s.
- [ ] Lighting phrase and an `Avoid:` line; 60–100 words per shot; English.
