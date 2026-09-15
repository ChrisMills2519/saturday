# Game art — vendored files

- `mascot-lobby.png` — 1000x1000 transparent, waving/happy (purple blob, in-house CC0)
- `mascot-reveal.png` — 1000x1000 transparent, shocked/hands-up (pink blob, in-house CC0)
- `mascot-score.png` — 1000x1000 transparent, trophy + party hat (in-house CC0)
- `bg-burst.png` — 1920x1080 dark plum sunburst (in-house CC0)
- Root `public/`: `favicon.png` (64), `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png` (PWA, derived from lobby mascot), `og-image.png` (1200x630 share card), `manifest.webmanifest`

Style: thick black outline 8-12px, flat pink/purple/yellow/teal.
80px padding so TV overscan never clips. App works without them
(CSS burst + walkers), they just pop in when present.

## Provenance
- All PNGs generated in-repo with PIL (no external source, CC0, no attribution needed) — 2026-09-15.
- Scouted but NOT vendored: Kenney `Shape Characters` https://kenney.nl/assets/shape-characters (CC0, modular parts too small for 1000px TV mascots); OGA Blobby/Goblin (CC-BY-SA/CC-BY, attribution required — skipped per AGENTS.md rule).
- Root icons/og-image derived from the in-house lobby mascot + burst (same CC0).
