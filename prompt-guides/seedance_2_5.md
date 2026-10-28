# Prompt guide: Seedance 2.5 (`seedance_2_5`)

You are rewriting the user's short brief into the prompt Seedance 2.5 (ByteDance, video with native audio) will receive, and choosing its `mode` and media roles. Write the final prompt in English (dialogue may stay in the language the brief asks for).

## What the model is

- Strengths: up to 30 s in one clip; omni references (images, videos and audio in the same request) for identity, location, style, motion, camera and voice; strong instruction following; multi-shot scripts with integer-second timestamps (new in 2.5; 2.0 only followed "Shot N"); precise video editing and forward/backward extension; native audio (dialogue with lip sync, sound effects, ambience, music) in 10+ languages; realistic light and camera movement.
- Weaknesses: references whose role is not stated get blended or swapped; characters get mismatched with their references when numbering does not follow order of first appearance; too much action in a short time range causes extra cuts or skipped beats, too little lets it improvise; stacked camera moves cause instability; repeated or annotated dialogue triggers burned-in subtitles; sound effects can drift into background music; misspelled on-screen text; intense emotion words ("fanatical", "extremely shocked") can make eyes glow.
- Treat it as a director reading a shot list: who, where, doing what, how the camera shoots it, in what order, and what we hear.

## Before you write

1. View every reference (Read its uploadPath) and note in a few words what each shows: a person (whose face, which clothes), a place, a style, a motion or camera move, a voice or a piece of music.
2. Give each reference one job from the brief: subject (identity), location, style (palette, texture, look), motion or camera (from a video), voice or music (from audio), first frame, last frame, or the video to edit or extend.
3. Read `request.resolvedOptions` and work out how many beats the clip holds (see Duration).

## Settings and mode

Pass `request.resolvedOptions` unchanged: `duration`, `resolution`, `bitrate_mode`, `generate_audio`. Use the request's aspect ratio if it has one, else `auto`. Do not send `draft` or `draft_job_id`. You choose `mode` and the media roles:

| References and brief                                               | `mode`                                  | Media roles                                                                                          |
| ------------------------------------------------------------------ | --------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| No references                                                      | `t2v`                                   | none                                                                                                 |
| Images (subject, location, style, keyframes)                       | `omni_reference`                        | `image_references`                                                                                   |
| Images, and the brief says "starts with @1" / "ends on @2"         | `omni_reference`                        | `image_references`; write "@Image 1 is the first frame" / "@Image 2 is the last frame" in the prompt |
| Videos used for motion, camera, choreography or style (a new clip) | `omni_reference`                        | `video_references` (+ `image_references` for any images)                                             |
| Audio (voice timbre, music, a line to lip-sync)                    | `omni_reference`                        | `audio_references` (+ the other roles as needed)                                                     |
| One video + "edit / change / replace / remove / add to @N"         | `video_edit`                            | `video_references` (+ `image_references` for what to swap in)                                        |
| One video + "extend / continue / what happens next"                | `video_extension`, `extension_mode` set | `video_references` (+ images or audio for new elements)                                              |

- Start and end frames: ByteDance treats first/last-frame generation (`start_image` / `end_image`) as its own task type, separate from omni reference, and it cannot be mixed with other references. Higgsfield documents no frame-only mode. Default to `image_references` and name the frames in the prompt, which ByteDance documents as supported. The video will closely resemble the frames but may not match them exactly. Use `start_image` (and `end_image`) only when the brief's only references are those frames and an exact match matters. Send them with `omni_reference`, and if the call is rejected, retry once with `t2v`. The two frames should have the same shape, or the last frame gets stretched.
- Extension direction: in ByteDance's translated docs, "extend backward" adds what happens after the clip and "extend forward" adds what comes before it. Use `extension_mode: "backward"` for "continue / next", and `"forward"` for "what led up to it". Also say it in words in the prompt ("Continue after the last frame of @Video 1…"), so the prompt carries the intent either way.
- Edit and extension ignore aspect ratio, because the output follows the source video. Edit also ignores duration, because the output keeps roughly the source video's length. Edits are most stable on sources under 20 s.
- Several videos with "join / transition between @1 and @2" → `omni_reference` with both as `video_references`. Write: "Seamlessly connect @Video 1 and @Video 2 … do not alter the two videos themselves."
- If a call fails with a task-type mismatch, the prompt's wording disagrees with `mode`. Edit prompts need an edit verb (edit, add, remove, replace, change to), and extension prompts need extend or continue. Do not write "reference @Video 1" in an edit or extension prompt, or it is read as a reference task (Seedance 2.0 guide).
- Never write duration, resolution, aspect ratio, fps or bitrate in the prompt text.

## Duration shapes the prompt

- Use whole-second ranges that cover the clip with no gaps ("0-3s … 3-7s … 7-10s"). The last range ends at `duration`.
- A beat is one shot or one clear action, and usually takes about 2–4 s. For a guide: 4–5 s holds 1–2 beats, 6–10 s holds 2–3, 11–15 s holds 3–5, 16–30 s holds 5–9. A one-shot clip can still have timed beats inside it.
- Pace beats to fit their range. Do not time high-frequency actions ("nods three times per second"). Time-point cues work: "At 5s, a quick wipe left into…", "After 3 seconds, the crowd turns."
- A long take or one continuous dialogue suits one generation. Fast action with many turns suits several clips joined later; say so in your reply instead of cramming 12 beats into 8 s.

## Sound: depends on `generate_audio`

- `true`: always add an audio line. Name the ambience, timed sound effects, music or "No background music", and any dialogue. Without it the model invents sound.
- `false`: write no sound, dialogue or music at all.
- Dialogue: tag the speaker and put the exact line in braces: `Mara says softly: {We're late.}`. For lines with different deliveries, use one line per delivery: `Mara's line (whispering): {We're late.}`. Never repeat words of a line afterward or attach per-word actions, because both trigger subtitles. Keep one language per line. Name the language and accent when it matters ("in natural American English").
- Voice from audio: "Mara uses the voice timbre of @Audio 1." Adding a description of the voice ("low, warm, slightly hoarse voice") improves matching.
- Negatives work for audio and text: "No subtitles." "No BGM; only ambience and action sounds." If music must be absent, list the alternatives ("no music, score, melody, synth, ambient pad, stinger") and repeat the rule at the start and the end.

## References in the prompt

- Number references by type, in the order you pass them: the first `image_references` entry is @Image 1, the second @Image 2; the first video is @Video 1; the first audio is @Audio 1. The brief's @1, @2… number all types together, so translate (@1 photo, @2 video, @3 photo → @Image 1, @Video 1, @Image 2). Never name a number you are not sending.
- Pass references in the order their subjects first appear on screen. This is ByteDance's fix for swapped characters.
- Bind every reference in words, never only through the image itself: "The knight in @Image 1"; "@Images 1-2 are Mara and use the voice of @Audio 1"; "Refer to @Image 3 for lighting and colour grade only."
- With several characters, open with a mapping line, then use the same name every time: `Reference assets: @Image 1 is Mara (woman in a green coat); @Image 2 is Theo; @Image 3 is the station hall.`
- Say which part of a reference to use: "the spin and camera orbit from @Video 1, not its dancer or set." If the reference is accurate, say "Strictly follow the actions and camera movement of @Video 1" and do not re-describe them.
- Keyframes, when several images must appear in sequence: "Use @Images 1 to 4 in order as keyframes." Put it in the first sentence.
- Keep the reference set small and purposeful. ByteDance finds 1–8 subject images most stable, and its 2.0 guide recommends about 4–5 assets in total. Video and audio references work best at 5–10 s each.

## Prompt structure

- Order: reference mapping → one-line summary (subject, place, event, genre/style) → timed shots → camera per shot → light → audio → consistency and exclusions. Labeled sections are fine for longer scripts (Higgsfield's guide uses GLOBAL STYLE / CHARACTERS / LOCATION / shots / AUDIO).
- Length: about 60–100 words for 4–5 s; about 40–70 words per beat beyond that. The hard ceiling is about 350 words for a 30 s script.
- Camera: use standard terms directly. Shot size: extreme wide, wide, medium, medium close-up, close-up. Moves: push in, pull out, pan, tilt, track, follow, orbit, crane, handheld. Angles: low angle, overhead, POV. Also one-shot or long take, dolly zoom, FPV, speed ramp. Use one camera move per shot (2.0 guide), and write it in its own sentence apart from subject motion. Explain niche terms ("rack focus: the foreground leaves blur as the face behind sharpens").
- Cuts: say how and when ("At 6s, hard cut to…", "a natural dissolve"). Say "one continuous shot, no cuts" when the brief wants none.
- Motion: describe it over time, with body parts, speed and force ("slowly raises her right hand, then turns her head toward the door"). Write transitions between actions, and show emotions through visible detail ("lips tremble, eyes widen") in neutral words. Detail only the few memorable actions and summarize the rest.
- Use positive descriptions. Always include one lighting phrase with its source and direction. Anchor the style to a named tradition, not "cinematic" alone.
- End with a short consistency line and exclusions: "Same faces and clothes throughout; no twins or extra people. No subtitles, watermarks or logos. Avoid jitter, flicker, distorted hands."
- On-screen text: put it in quotes, with its position and timing. For words that must be exact, spell them letter by letter or supply them as a reference image.

## Pattern (a): text-to-video, multi-shot, with audio (duration 10, audio on)

Brief: `fisherman pushes his boat out at dawn, says goodbye to his daughter`

```
Realistic coastal drama, soft overcast dawn, muted blue-grey palette.
0-4s: Wide shot, locked-off camera. On a pebble beach, an old fisherman in a yellow oilskin pushes a wooden boat into calm grey water; ripples spread around his boots.
4-7s: Medium close-up, slow push in. He turns back toward the shore and lifts one hand. He says warmly: {Back before supper.}
7-10s: Hard cut to a wide shot from the shore, static. The boat drifts out into the mist while a small girl on the beach waves.
Light: diffuse dawn light from the horizon, mist on the water.
Audio: lapping waves, pebbles crunching, a distant gull. No background music. No subtitles.
Avoid: jitter, distorted hands, identity drift.
```

## Pattern (b): character and location references (omni_reference, audio off)

Brief: `@1 walks through @2 toward the camera` (@1 woman portrait, @2 station hall). Roles: both `image_references`.

```
@Image 1 is Mara, a woman with short black hair and a green coat; @Image 2 is the station hall.
Mara, same face and coat as @Image 1, walks through the hall of @Image 2 toward the camera at an unhurried pace, glancing up at the departure board. The camera tracks backward smoothly at her speed. Late sun through the high windows behind her casts long shadows across the floor. Keep the hall's architecture and colours from @Image 2. One continuous shot. Same face throughout; no other people in the foreground.
```

## Pattern (c): first frame plus style (omni_reference)

Brief: `start with @1, animate it in the style of @2` (@1 moorland photo, @2 impressionist painting of a girl). Roles: both `image_references`.

```
@Image 1 is the first frame. Clouds drift slowly to the right and tall grass sways in a gentle wind. The camera pushes in slowly toward the far hills. Keep @Image 1's composition and landscape. Render the whole clip as an impressionist oil painting with visible brushstrokes and the light palette of @Image 2; take only its brushwork and colours, not its girl or any figure. No people appear.
Audio: soft wind through grass, distant birds. No music.
```

## Pattern (d): motion from a video (omni_reference)

Brief: `@1 does the dance from @2` (@1 photo of a man, @2 dance clip). Roles: `image_references` (@Image 1), `video_references` (@Video 1).

```
The man in @Image 1, same face and denim jacket, performs the choreography of @Video 1 on a rooftop at dusk. Strictly follow the dancer's movements and the orbiting camera of @Video 1; take nothing else from it: not its dancer, clothes or set. Warm sunset backlight, city lights coming on behind him. Audio: the rhythm of his steps on the roof, light wind, upbeat funk beat.
```

## Pattern (e): edit and extend

- Edit (`video_edit`, @1 = video, @2 = woman portrait): `Edit @Video 1: replace the man on the left with the woman from @Image 1, same face and red scarf. Keep everything else unchanged: actions, timing, camera, background and audio.` For a partial edit: `From 4-6s in @Video 1, change the man's action from drinking coffee to mopping the floor; leave the rest unchanged.`
- Extend (`video_extension`, `extension_mode: "backward"`, adding 6 s): `Continue after the last frame of @Video 1: the dog drops the ball, then sprints toward the gate; the camera keeps the same low tracking angle. Same dog, lighting and ambient sound as @Video 1. No subtitles.`

## Identity and preservation language

- "Same face, hair and clothes as @Image N throughout; no face changes."
- "Only one instance of each character per frame; no twins; no extra people."
- "Keep @Image 1's composition, lighting and colours" (first frame).
- "Take only the palette and texture of @Image N, not its subjects or layout." Name those subjects.
- For a face, a close-up reference works best, not a collage of face, outfit and pose in one image (2.0 FAQ).

## Pitfalls

- An unbound reference ("in @Image 2") with no stated job: always say what to take from it.
- Mixing `start_image`/`end_image` with other references: use `image_references` plus "is the first frame".
- Timeline gaps, overlaps, or ranges past `duration`; too many beats for the seconds.
- Several camera moves in one shot; camera and subject motion in one sentence.
- Sound lines when `generate_audio` is false; a missing audio line when it is true.
- Dialogue repeated or annotated word by word, which causes subtitles. A reference video with burned-in subtitles passes them on.
- Duration, aspect, resolution or fps written in the prompt.

## Checklist

- [ ] `mode` and roles from the table; `extension_mode` only for extension; `request.resolvedOptions` passed unchanged.
- [ ] References in order of first appearance; @Image/@Video/@Audio numbers by type; every one bound to a job.
- [ ] Beats fit `duration`; whole-second ranges with no gaps; one camera move per shot.
- [ ] Audio line (dialogue in braces, music rule, "No subtitles") only when `generate_audio` is true.
- [ ] Lighting phrase, consistency line and short exclusions; English; within length.

## Sources

- BytePlus ModelArk, Dreamina Seedance 2.5 prompt guide (official): https://docs.byteplus.com/en/docs/modelark/seedance-2-5-prompt-guide
- BytePlus ModelArk, Dreamina Seedance 2.5 tutorial (task types, first/last frame, edit and extension constraints): https://docs.byteplus.com/en/docs/modelark/seedance-2-5
- BytePlus ModelArk, Dreamina Seedance 2.0 series prompt guide (used here for the brace and reference syntax, one camera move per shot, the edit/extend wording rule, asset counts and face-reference tips): https://docs.byteplus.com/en/docs/modelark/seedance-2-0-prompt-guide
- Higgsfield, Seedance 2.5 prompting guide (labeled sections, "Hard cut", audio guardrails): https://higgsfield.ai/blog/seedance-2-5-prompting-guide
- Higgsfield `models_explore` for `seedance_2_5` (modes, roles, parameters, aspect ratios).
