# Calling progression in Fast World

The Town of Beginnings supports changing Calling, choosing a Veteran specialisation, and equipping mastered G and F augments. The server checks the new town's bounds and elevation. The initial Calling can still be chosen outside town as an onboarding recovery. Later changes require returning to town; Veteran specialisations remain permanently bound to their Calling.

G selects Core, Aggressive or Master abilities. F always uses the Calling's Utility Special, unlocked at character level 4. Old saves with a Utility on G resolve to the Core ability without discarding XP, specialisation, trial progress or augments. Kit exposes separate F augment choices and shows the selected upgrade. Practice selections use the same keys.

Mage ranks reduce G spell cooldowns by 5% each. At Adept rank, every third Arcane Surge or initial Overload blast that hits enemies gains Arcane Echo. Empty casts and aftershocks do not advance the counter. Echo strength is 50%, 75% for Arcanist, and 100% after mastery; existing Echoing equipment still contributes. Each echoed cast advances Arcanist's trial once regardless of target count. Death, disconnect and Calling changes clear the counter.

Elementalist applies its slow through Arcane Surge, Overload and Mana Shield shatter. Killing a slowed enemy before expiry credits its trial, including an eligible teammate finishing the enemy. Defeat consumes the trial tag once. Mastery increases the slow's duration and strength.

Thief Clean Getaway conceals for 1.5 seconds rather than restoring health. Its trial counts Escape Artist uses while a nearby enemy pursues the Thief. Existing mastery remains earned.

Validation: full type checks, production builds and 2,163 reported tests pass. Regression coverage includes town versus field restrictions, all six Utility slot migrations, F augments, empty casts, multi-target Overload/aftershock accounting, slow expiry and retained Thief mastery. Browser playtesting remains pending because local browser access is disabled in Work settings.
