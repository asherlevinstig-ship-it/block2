# Most Powerful Hunters

Open the Fellowship Hall and choose **Most Powerful Hunters**. The world leaderboard includes named saved characters, with active room profiles overriding their saved versions. The top 20 and your own standing are shown. Account IDs and email addresses are never sent to the client.

The right-side HUD also shows the top three and your standing; click its heading for the full leaderboard. It refreshes on Hunter rank promotion, joining/changing rooms, remote player arrivals/departures, or manual refresh. There is no periodic standings polling. Server-selected online champions wear a floating gold crown above their head, including all tied leaders (not merely those inside the top 20). Crowns follow characters in every dimension and are removed on disconnect, room changes, or loss of leadership. Offline champions appear in the panel but naturally have no visible character crown. This crown is separate from the King event objective.

Five equally weighted categories contribute up to 20 points each. Scores are midrank percentiles against the named-player population, not raw sums; this prevents gold or XP units from overwhelming other categories. Equal combined scores share a place. Level, then XP, then an internal stable ID determine display order for ties without breaking the shared place.

- Stats: STR + AGI + VIT + INT (allocated base stats, not equipment).
- XP: completed-level XP requirements plus current-level XP. This represents progression XP, not lifetime earned XP after resets/admin edits.
- Money: current gold, not lifetime earnings.
- Level/rank: current global Hunter level; rank is derived from that level and is not double-counted.
- Guild Level: 1 + floor(sqrt(lifetime Renown / 100)). Unguilded characters score zero here. Spending Renown does not lower this level.

The first request after server startup lazily loads saved profiles once, shared across all rooms in that process. Existing successful profile saves, transaction commits and deletions update the snapshot in memory, with no extra database operations. Online profiles are overlaid on every request. Requests are rate-limited. Firebase reads use projected fields and 500-document pages; the initial scan incurs one document read per saved profile, plus any empty-page minimum. Usage counters record returned document counts instead of charging 500 per page. Server restarts cause a new initial scan. External database edits require a restart to reload unless made through the normal save path. Failed initial loads can be retried on a subsequent request.

Money, XP, stats and guild changes are included at the next triggered/manual refresh, but do not themselves trigger HUD updates. Rank-up means an E/D/C/B/A/S promotion, not every individual level-up.

This is a standings/title mechanic only: it does not grant combat buffs, currency, or rewards. Admin-edited named characters are currently included.

Run `npm run test:power` for scoring and cache regression tests.
