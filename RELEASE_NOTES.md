# Website release — 2026-11-09

Published from `main` at the repository root, with GitHub Pages and `.nojekyll`.
Website: https://pj202606-nn.github.io/byeolungwan-main-site/

## Performance changes

- Full-resolution display variants of 33 photos/backgrounds: 44.13 MB → 8.56 MB. Original artwork is retained locally; WebP variants use quality 92. The map viewer still loads its optimized SVG on demand.
- Local variable fonts replace the external stylesheet. Serif WOFF2: 4.75 MB → 0.24 MB. See `fonts/Web-fonts-README.md` for coverage and licensing.
- Decorative O-01/M-00 star discs use lossless 2400px WebP caches with the original rotation centers and 205-second rotation. Separate lightweight stars preserve twinkling. Original SVG is retained as a loading/error fallback and as artwork for other opening scenes; interactive constellation artwork remains SVG.
- Offscreen photographs load lazily. The story cover is fetched early to avoid late appearance. The zoom viewer bounds its backing surface at 12 million pixels on mobile and 24 million on desktop while retaining the 0.5–16× interaction range.

## Measurements

Chrome headless, same 3-second phases, DPR 1. CPU throttling emulates load and is not a physical-device test; RAF cadence is not presented-display FPS.

| Mobile CPU ×4 | Before | After |
|---|---:|---:|
| Opening average RAF interval | 75.8 ms | 19.8 ms |
| Main average RAF interval | 57.7 ms | 22.2 ms |
| Opening long tasks | 40 | 0 |
| Main long tasks | 46 | 0 |

Measured local resource bytes through the content phase decreased from 28.15 MB to 10.58 MB on desktop and 23.70 MB to 9.60 MB on mobile. This is not a guaranteed network transfer total or real-device frame rate. The optimized guardian portraits further reduce subsequent slideshow requests.

## Functional checks

Release QA covers opening scenes, lantern reset, navigation and other overlays, date validation and selected-star result, dictionary/search/group selection, compatibility graph and paired results, story assets, last-story alignment and forward/reverse looping, and map zoom/reset/close.

Birthday allocation, compatibility scores and fortune copy remain exhibition demo data pending final project data. Original 259 MB map and print card JPGs are not deployed. Local QA scripts, screenshots and work reports are excluded from the publication.
