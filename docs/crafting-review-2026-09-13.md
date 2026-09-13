# Crafting review — 2026-09-13

Overall release-readiness: **Red** until material-loss and false-success paths
are corrected. Design quality: **Amber**. This is a local code audit with focused
handler reproductions and one browser journey, not a production incident analysis
or a timed human gathering study. No crafting implementation was changed.

## Scope and evidence

The authoritative catalog contains 73 recipes, 58 distinct outputs and 10 smelts.
It covers construction, four material tiers of tools, armor, repairs, foods,
companion items and regional-material alternatives. Six recipe entries have Hunter
level requirements. Legendary token crafting is a separate system.

The early-crafting browser test passed without retries: it stages and crafts the
starter weapon and claims the post-combat upgrade. Its fixture supplies gathered
logs and combat credit; this does not measure real gathering or fighting pace.
All 23 tests selected by `craft|recipe|furnace|smelt` in the authority and client
module suites passed. The failures below are coverage gaps in that passing set.

## Confirmed reliability and authority findings

1. **Ordinary crafting can destroy paid output.** In `handleCraft`, materials are
   consumed before output capacity is checked, and the remainder returned by
   `addCraftedRewardItem` is ignored. Reproduction: a 36-slot bag with 64 logs in
   one slot and 64 dirt in every other slot; craft one log into four planks.
   Result: 63 logs, zero planks, and a success message advertising four planks.
   Furnace collection and legendary crafting already check capacity.

2. **Save failure still produces success.** `savePlayerProfileNow` returns false
   when saving fails. Ordinary and legendary crafting await it but do not inspect
   that result. A focused ordinary-crafting reproduction with a false save result
   still emitted `craftResult`. In-memory changes remain dirty for later saving,
   so loss is not inevitable, but the success message does not guarantee durability.

3. **The table requirement is enforced only in the client flow.** Ordinary
   crafting accepts client-supplied grid width. A direct handler invocation with
   eight cobblestone and a 3×3 furnace recipe succeeded without any player-position
   or station state. Ingredients and recipe matching are still enforced; this
   bypass concerns station access. Furnace actions separately validate a real
   furnace block within six horizontal units.

## Design and usability ratings

| Area | Rating | Assessment |
| --- | --- | --- |
| Core loop | Amber | Logs, planks, sticks, tools, mining and smelting form a readable chain. Actual time and enjoyment need observation. |
| Recipe guidance | Green | Categories, missing ingredients, purpose tags, table requirements and objective shortcuts support deliberate crafting. |
| Discovery | Amber | Material-based visibility reduces clutter, but hiding recipes can obscure future goals. A locked preview would expose useful next steps. |
| Batch usability | Amber | Shift crafting exists, but recipe auto-fill stages one item per ingredient cell. A freshly auto-filled grid therefore supports only one craft even when the bag holds many ingredients. |
| Progression and choice | Amber | Regional alternatives and armor/food variety help. Four linear tool tiers alone do not establish interesting specialization or crafted-versus-looted gear balance. |
| Smelting | Amber | Five seconds per item, one fuel per item, and a busy/output gate. Manual collection/input cycles may become repetitive when making full equipment sets. |
| Feedback and recovery | Red | Ordinary rejection generally says missing server-side ingredients, including unrelated rejection cases. Requests lack a pending guard or response ID; result handling consumes the current grid. Delayed responses after grid edits deserve a dedicated test. |
| Inventory and durability safety | Red | Confirmed output loss and acknowledgement after failed persistence. |
| Rule enforcement | Red | Recipe/material/level checks exist, but table access is not validated by the ordinary craft handler. |
| Regression coverage | Amber | Happy paths and several safeguards pass; the reproduced boundary cases are missing. |

## Recommended order

1. Make crafting capacity-aware after accounting for consumed ingredients. Grant
   the entire paid output, or leave materials unchanged. Test full bags and batches.
2. Handle persistence failure explicitly without making retries double-charge.
3. Correlate requests/results, track pending crafts, and provide specific failure
   messages for space, rate, recipe, level, ingredients and saving.
4. Enforce the intended station rule server-side, including any explicitly allowed
   tutorial or NPC exceptions.
5. Offer quantity selection and a full-batch cost/output preview. Make auto-fill
   and batch crafting work together.
6. Test the real gather-to-upgrade journey, then review smelting repetition and
   whether competing recipes create worthwhile spending decisions. Prioritize
   these over adding more recipes.
