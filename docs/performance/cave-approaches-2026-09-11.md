# Cave entrance approaches — 2026-09-11

Cave mouths face north. Town-facing vegetation clearings did not expose them when a hillside lay in front of the entrance.

The shared terrain helper now cuts a 22-block stepped approach north of each mouth. It flares to seven blocks wide near the entrance and narrows to five farther out. Centerline steps change height by at most one block. The cutting clears overhead terrain and fills below its cobbled floor, leaving the original entrance and underground cave layout untouched. It runs on generated terrain before saved edits are applied; existing edits can still obstruct the approach.

The browser review uses the actual modified ground height and looks into the north-facing mouth. Above-ground block comparisons in nine sampled areas remain identical between the client and authoritative server generator. Unit coverage checks ascending and descending approaches, headroom, bounded edits and the unchanged mouth. Full traversal of every cave and old-save appearance remain unverified.

Validation: 886 unit tests and 19 integration checks passed. The build passed. The browser capture/parity check is opt-in through VISUAL_REVIEW=1 and e2e/environment-identity.spec.js.

Deployment investigation also found the previous GitHub validation failure came from Multer 2.2.0 advisories. The lockfile now selects compatible Multer 2.3.0. The high-severity audit gate passes; 18 low/moderate transitive findings remain. No audit threshold was weakened.
