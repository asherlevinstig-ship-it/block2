# Vegetation silhouettes and landmark approaches — 2026-09-11

This pass gives forests taller, narrow stepped crowns and swamps broad, low crowns with broken hanging edges. Plains and snowy trees keep their previous shape. The shared generator is used by client terrain, both server world generators, and natural-tree recovery. Recovery searches extend to the new three-block canopy radius.

Major landmarks receive short, five-block-wide vegetation clearings on the town-facing approach, 12–28 blocks from their center. Clearing touches only generated logs/leaves and runs before saved world edits are applied. Hills, stone and other props remain. Watchtowers rise from 12 to 18 wall blocks, lifting their roof and corner lights above ordinary trees.

The changes remain chunk-meshed terrain. Tree block counts are bounded by tests, but this pass does not establish a new low-end frame-time budget. Existing saved edits continue to overlay the revised base world; older removed-tree edits may leave partial new crowns. Deploy the client and Colyseus server from the same commit and refresh existing clients because the base collision terrain has changed.

## Reviewed

Local Chromium, 800 × 600: six biome views and town-facing views of a watchtower, cave and Elderheart Tree. Forest crowns are taller; swamp canopies spread horizontally. The watchtower silhouette and giant tree remain recognizable above their surroundings. The sampled cave approach remains partly concealed by a hillside: vegetation clearance alone cannot solve its terrain composition.

The browser check compares above-ground blocks in nine sampled areas between the rendered client world and a freshly generated authoritative server world. All sampled blocks agree. An initial whole-column comparison also encountered an existing underground ore difference (client block 15 vs server block 3); the parity assertion is intentionally scoped to above-ground changes. It does not claim full-world parity.

All 885 unit tests, lint, formatting and the static build passed. The browser visual/parity test passed. New unit coverage checks crown proportions and size bounds, outer-canopy recovery, and selective approach clearing.

```powershell
$env:VISUAL_REVIEW='1'
$env:VISUAL_PHASE='silhouettes'
npx playwright test e2e/environment-identity.spec.js --grep 'six overworld' --retries=0
```

Recorded browser runs used an isolated server on port 2649. Screenshots are Playwright attachments. Live deployment, old-save appearance, full regional traversal and sustained combat performance were not verified in this pass. Visual identity remains amber while cave approaches and mixed-biome composition need further review.
