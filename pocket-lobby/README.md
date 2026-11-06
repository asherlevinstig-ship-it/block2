# Tower of Beginnings

The current game is in `public/`, hosted by the Worker in `../worker/index.js`. The original Colyseus proxy under `/game/` is retained for the archived Block2 backend. Current social rooms use the `SHARED_ROOMS` Durable Object binding.

## Accounts and rooms

- Guests can play immediately. Account → Create account attaches their existing D1 character, preserving inventory, home, attributes and offline plans.
- Username/password sign-in opens that same character on another device. Passwords use salted native scrypt (N=16384, r=8, p=5). Sessions use hashed random tokens and secure HttpOnly cookies, expire after 30 days, and are limited to ten per account.
- Recovery uses a random single-use code, shown after registration/reset. Reset rotates the code and revokes existing sessions. Generating a replacement code requires the current password. No email provider is required.
- Public lobby, lounge, courtyard and shops share movement, appearance, equipped weapons, seating, waves and room chat, capped at 20 connections per room. A second connection for the same character replaces the first in that room. Chat retains the last 40 messages; no moderation/reporting system is included yet.
- Home room identity is derived from the authenticated player on the server. Other players cannot choose its owner. Previously personal lounge furnishings return to the player's inventory; public lounge layout is fixed.
- Adventure areas remain personal. Economy and active combat still use the existing client snapshot save system; this release does not make those systems authoritative. Movement validation applies to social-room presence.
- Character keys prevent a stale tab from saving into a different account after sign-in. Pending local saves are also tied to the character. Account changes clear local character caches.

## Development and deployment

Use Node 22.17+ for tests (the database tests use `node:sqlite`). Run all `tests/*.test.mjs` with `node --test`, passing their expanded file paths on PowerShell.

Before the first account-enabled deployment, apply the additive D1 migrations using Wrangler with `--config pocket-lobby/wrangler.toml` from the repository root. Use `--local` for a separate development database and `--remote` for production. Deploy the same config; its SQLite Durable Object migration creates the social-room namespace. Do not remove the D1 or Durable Object bindings on later releases.

The current config enables `nodejs_compat` for native password hashing. Test this on the target Workers runtime before changing the password format or compatibility flags. Do not lower password hashing work factors to work around runtime limits.

## Tower job board

The lobby directory and the reception's Job board sign open a unified shift planner. Players choose fishing or woodcutting and 1, 2, 4 or 8 hours. The preview uses the same rod pacing and timber interval as settlement, caps fishing by bait and timber by inventory space, and labels sale values separately from gold earned. Fishing requires a prior visit to the pond; woodcutting requires the woodcutter's axe. Dispatch is validated from `hub` on the server, moves the saved character to its work area, and uses the existing one-plan-at-a-time revision/idempotency checks. Field-started plans remain available. Return reports show elapsed time, supplies, XP, level changes and sale value; the report must be acknowledged before play resumes.
