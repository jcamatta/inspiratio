# PureRef and alternatives — research notes

_Researched October 2026. Feature lists come from product pages, release notes and press coverage (sources at the end).
Smaller tools change fast, so check the vendor before relying on a specific detail._

## PureRef (Idyllic Pixel) — the reference point

A lightweight desktop app (Windows / macOS / Linux) that holds reference images on an infinite canvas next to the
software you work in.

| Area       | What it does                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Collecting | Drag & drop from desktop or browser, paste from clipboard, screenshots                                                          |
| Canvas     | Infinite canvas, free move / scale / rotate / flip, crop, grayscale, align & "optimize" (auto-pack) arrangements                |
| Annotation | Text notes; since **2.0** (May 2024) drawing on images; since **2.1** (Feb 2026) shapes, line/dot background grid with snapping |
| Media      | Still images; since **2.0** GIF playback with frame stepping. **No real video support**                                         |
| Window     | Always-on-top, adjustable transparency, overlay / click-through mode, pin on top of a chosen app (2.0)                          |
| Files      | One `.pur` scene file that can embed the images; 2.1 adds an image management tool (downscaling, formats, locations)            |
| Organising | Spatial only — **no tags, no metadata, no search**                                                                              |
| AI         | None                                                                                                                            |

**Why it is not enough for this workflow:** no video, no tags or metadata, no search, no link to a generation tool, and
the `.pur` format is opaque to scripts and agents.

## Alternatives

| Tool                            | Type                                  | Strengths                                                                                    | Gaps for short-film references                             |
| ------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **BeeRef**                      | Open-source PureRef clone (desktop)   | Free; scenes are SQLite files; scale / rotate / flip / crop                                  | Images only; no tags; small feature set                    |
| **Kuadro**                      | PureRef-like (Windows)                | Minimal always-on-top board                                                                  | Windows-only; images only                                  |
| **Zenboard**                    | macOS reference board                 | Images, **videos** and text side by side                                                     | macOS only; no metadata layer                              |
| **Eagle**                       | Asset library manager (paid)          | Tags, folders, smart folders, colour filters, browser extension; images, video, audio, fonts | A library grid, not a free-form canvas; no generation link |
| **Allusion**                    | Open-source library manager           | Tags over local folders, search                                                              | No canvas; images only                                     |
| **Kosmik**                      | Infinite canvas with built-in browser | Images, video, PDFs, links; AI auto-tagging and search                                       | Cloud/proprietary; no Higgsfield / agent integration       |
| **Milanote**                    | Online boards for creatives           | Notes, images, links, columns, collaboration                                                 | Web-only; weak with video; no local files                  |
| **Cosmos / Are.na / Pinterest** | Discovery + collections               | Great sources to _find_ references; boards and channels                                      | Online only; no local canvas; no generation link           |
| **FigJam / Miro / Muse**        | Whiteboards                           | Infinite canvas, sticky notes, collaboration                                                 | General-purpose; heavy for a personal mood wall            |
| **ShotDeck / FilmGrab / Flim**  | Film-still libraries                  | Searchable stills (Flim: by colour/composition)                                              | Sources, not organisers                                    |

## What Inspiratio takes from each

| Feature                                                                  | Inspired by                       | In Inspiratio                                       |
| ------------------------------------------------------------------------ | --------------------------------- | --------------------------------------------------- |
| Infinite canvas, drag from browser/desktop, paste                        | PureRef, BeeRef                   | ✅ React Flow canvas, file/URL/HTML drops, `Ctrl+V` |
| Free move / resize with aspect lock, z-order, fit-to-view                | PureRef                           | ✅                                                  |
| Video on the canvas with play / pause / restart / scrub                  | Zenboard, Kosmik                  | ✅                                                  |
| Captions / titles under each item                                        | PureRef notes                     | ✅ double-click to rename                           |
| Global tags (combobox, create inline), filter + dim                      | Eagle, Allusion                   | ✅                                                  |
| Sections (groups that move their children)                               | Milanote columns, FigJam sections | ✅                                                  |
| Metadata per item (source URL, dimensions, origin, prompt, model)        | Eagle                             | ✅                                                  |
| Import a page link and get its media (Open Graph)                        | Kosmik's browser, Eagle extension | ✅ Pinterest/Cosmos/film-still pages                |
| Plain files on disk + readable JSON index                                | — (PureRef's `.pur` is opaque)    | ✅ `data/media` + `data/library.json`               |
| Prompt composer with references → AI generation → results back on canvas | — (nobody does this)              | ✅ via Claude Code + Higgsfield MCP                 |

## Not done yet (candidates for the roadmap)

- **Always-on-top / transparency / click-through** needs a desktop shell (Tauri or Electron) around the web app.
- **Crop, flip, rotate, grayscale** as non-destructive view transforms.
- **Multiple boards** (one per short film) and board export/import (`.zip` with JSON + media).
- **Browser extension** for one-click capture with the page URL kept as metadata.
- **Colour palette extraction** and search by colour (Eagle, Flim).
- **Duplicate detection** (perceptual hash) on import.
- **Auto-arrange / pack** a selection (PureRef "optimize").

## Sources

- [PureRef 2.0 released with revamped UI, drawing, GIF support — 80.lv](https://80.lv/articles/pureref-2-0-released-with-revamped-ui-drawing-gif-support/)
- [PureRef 2.0 — CG Channel](https://www.cgchannel.com/?p=158376)
- [PureRef 2.0 — CGArchitect](https://cgarchitect.com/features/articles/693b1af1-pureref-2-0)
- [PureRef 2.1 adds shapes, grids and language support — CGPress](https://cgpress.org/archives/pureref-2-1-adds-shapes-grids-and-language-support.html)
- [PureRef 2.1 adds grids, lines, notes and control — Digital Production](https://digitalproduction.com/2026/02/11/pureref-2-1-adds-grids-lines-notes-and-control/)
- [PureRef alternatives — AlternativeTo](https://alternativeto.net/software/pureref/)
