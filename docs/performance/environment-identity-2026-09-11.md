# Environment identity review — 2026-09-11

Visual identity remains AMBER. This pass improves color cohesion and near-floor visibility; it does not complete biome architecture or landmark composition.

## Implemented

- Six restrained surface palettes: neutral plains, woodland green, sand warmth, mesa terracotta, cool snow and muted swamp green. Transitions blend over time instead of switching abruptly at a biome boundary.
- Town uses the neutral surface palette. Existing night, weather and shrine overrides retain their priority.
- Dungeon themes use warm stone, cold stone, moss, ember or arcane lighting families instead of a shared purple tint. Existing theme/affix fog colors remain.
- Dungeon fog starts at eight units instead of 5.5, with slightly brighter ambient lighting to expose nearby floors and model detail.
- Existing lights and terrain materials are reused. No new geometry, particles, draw calls or full-screen effects were added. Warning materials are not recolored.

## Visual review

Inspected local Chromium captures at 800 × 600 for plains, forest, desert, mesa, snowy and swamp terrain, plus Abandoned Mine, Sunken Crypt and Mossbound Cellar entry rooms. Captures omit HUD panels to expose the environment. Dungeon views before/after use independently generated runs; they are qualitative comparisons, not pixel-matched image regressions.

The three entry dungeons now communicate warmer industrial stone, cool crypt stone and green organic material more clearly. Separate captures place a zombie and melee warning in each room to inspect foreground contrast. These checks do not establish readability for every boss effect or encounter.

Overworld captures reveal the next composition problem: forest and swamp still share similar tree silhouettes, and several views contain dense mixtures of neighboring biome materials. Atmospheric color alone cannot solve this. Distinct vegetation shapes and deliberate sightlines to regional landmarks deserve a separate pass.

Higher-rank dungeon palettes are configured but were not visually reviewed. Night/storm transitions, physical low-end displays and the live deployment remain unreviewed in this pass.

## Repeat

```powershell
$env:VISUAL_REVIEW='1'
$env:VISUAL_PHASE='after'
npx playwright test e2e/environment-identity.spec.js --retries=0
$env:VISUAL_PHASE='readability'
npx playwright test e2e/environment-identity.spec.js --grep 'visual identity at entry' --retries=0
```

Screenshots are attached to Playwright results. The recorded runs used an isolated E2E server on port 2649 after the normal setup stalled on a subsequent run. Four environment capture tests passed; the three additional enemy/warning captures passed. Lint, formatting and the static build passed.
