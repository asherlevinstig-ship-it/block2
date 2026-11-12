# LiveWeave sign-in

Tower uses LiveWeave's existing student/teacher authentication. Passwords and personal account details are never copied into the game. D1 links the stable `student:<id>` or `teacher:<id>` identity to a game account; school ID is retained for future school-scoped features. Character names remain separate.

1. The game saves pending progress and starts a ten-minute browser-bound flow.
2. `https://liveweave.net/tower-auth.php` uses the existing account helpers. Anonymous visitors use the normal school login. The small `student_dashboard.php` hook includes `tower-auth-return.php` after `student_context.php`, resuming sign-in with a signed return cookie. Teachers use the existing `next` return destination.
3. LiveWeave issues a random two-minute authorization code. Only its hash and minimal identity are stored in a private file outside the document root.
4. The callback validates the browser, flow expiry and unchanged game account, then claims the flow once. It exchanges the code directly with LiveWeave using `LIVEWEAVE_AUTH_SECRET` and issues the game's secure session cookie.

The first link preserves the guest character or existing password account. Subsequent sign-ins load the character already associated with that LiveWeave identity. Conflicting links require signing out first; characters are never silently merged or overwritten. Existing password accounts retain password sign-in. Accounts created through LiveWeave have no game password or game recovery code.

## Deployment

- Worker variable: `LIVEWEAVE_AUTH_URL=https://liveweave.net/tower-auth.php`.
- Worker secret: `LIVEWEAVE_AUTH_SECRET` (64 hex characters), also stored privately on LiveWeave at `~/.config/tower-liveweave/secret`, mode `0600`.
- LiveWeave private code directory: `~/.config/tower-liveweave/codes`, mode `0700`.
- Install the two PHP files alongside LiveWeave's `student_auth.php` and `teacher_auth.php`. The callback origin is deliberately fixed in `tower-auth.php`.
- Apply `0012_liveweave_login.sql` normally. The start endpoint also creates these two tables idempotently for rolling deployments when D1 migration credentials are unavailable.
- Fetch current production files, back up the dashboard before editing, and record changes in LiveWeave's `AGENT_EDIT_LOG.md`. Do not deploy an old dashboard copy from this repository.

Codes, flow cookies, shared keys, passwords and session tokens must never be written to logs or committed. The bridge contains no public testing bypass.
