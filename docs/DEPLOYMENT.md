# Deployment and recovery runbook

## Production topology

Run exactly one Blockcraft server process. The overworld is a single authoritative
simulation and persistence writer; adding replicas would create divergent worlds.
Place the process behind an HTTPS reverse proxy that supports WebSocket upgrades and
replaces (rather than appends untrusted values to) `X-Forwarded-Proto` and
`X-Forwarded-For`. Do not expose the Node port directly to the public internet.

Use Node.js 20 and install the locked dependency tree with `npm ci`. Before release,
run `npm run check`, `npm run test:integration`, and `npm run test:e2e`.

## Required environment

Production startup fails before auth or room initialization when configuration is
unsafe or incomplete.

| Variable | Requirement |
| --- | --- |
| `NODE_ENV` | `production` |
| `PUBLIC_URL` | Absolute public `https://` URL |
| `TRUST_PROXY` | Proxy hop count, IP, subnet, or Express trust-proxy name; never `true` |
| `DATA_DIR` | Explicit absolute path on durable storage, writable by the service user |
| `STORE` | `json` or `firebase`; defaults to `json` outside production |
| `PORT` | Internal listen port; defaults to `2567` |

`DEV_CHEATS`, `BLOCKCRAFT_BETA_TEST`, and `BLOCKCRAFT_E2E` must be unset in
production. Never commit credentials or include them in a backup archive.

For `STORE=firebase`, install `firebase-admin` and provide exactly one supported
credential source:

- `GOOGLE_APPLICATION_CREDENTIALS`: readable service-account JSON path; or
- `FIREBASE_SERVICE_ACCOUNT`: service-account JSON supplied by the secret manager.

The service account needs access only to the Firestore project used by Blockcraft.
Firebase initialization fails closed in production. Authentication remains stored in
`DATA_DIR/auth.json` even when game state uses Firestore, so durable local storage and
backups are still mandatory.

## Reverse proxy requirements

The proxy must:

1. terminate TLS and redirect HTTP to HTTPS;
2. forward normal HTTP requests and WebSocket upgrades to `PORT`;
3. set `X-Forwarded-Proto: https` itself;
4. replace spoofable forwarding headers from public clients;
5. use timeouts long enough for persistent WebSocket sessions.

Set `TRUST_PROXY=1` only when exactly one controlled proxy sits between clients and
Node. Use the proxy IP/subnet when the network path is not fixed. The application emits
CSP, clickjacking, MIME-sniffing, permissions, and production HSTS headers.

## Release procedure

1. Back up the current deployment using the appropriate procedure below.
2. Install from the lockfile with `npm ci`.
3. Run `npm run check`, `npm run test:integration`, and `npm run test:e2e`.
4. Stop the old process gracefully so its final flush completes.
5. Start the new process with the production environment.
6. Confirm the startup log has no `[startup]`, `[store]`, or `[persist]` errors.
7. Register a disposable account, join the world, reconnect, and verify persistence.
8. Watch `[metrics]` logs for tick overruns, persistence failures, client counts, and
   unusual rejection spikes.

## JSON backup

JSON files use atomic writes, but a live copy can span different logical save moments.
For a consistent backup, stop the server gracefully before copying `DATA_DIR`.

Linux/macOS example:

```bash
tar -C /srv/blockcraft -czf blockcraft-data-YYYYMMDD-HHMMSS.tar.gz data
sha256sum blockcraft-data-YYYYMMDD-HHMMSS.tar.gz > blockcraft-data-YYYYMMDD-HHMMSS.tar.gz.sha256
```

PowerShell example:

```powershell
Compress-Archive -LiteralPath C:\Blockcraft\data -DestinationPath C:\Backups\blockcraft-data-YYYYMMDD-HHMMSS.zip
Get-FileHash C:\Backups\blockcraft-data-YYYYMMDD-HHMMSS.zip -Algorithm SHA256
```

Store backups encrypted outside the game host. They contain password hashes, active
session hashes, player identities, moderation reports, and complete world state. Keep
multiple generations and periodically test restoration on an isolated host.

## JSON restore

1. Stop the server and verify no Node process is writing `DATA_DIR`.
2. Verify the backup checksum and inspect the archive paths before extraction.
3. Move the current data directory aside as a rollback copy.
4. Extract the backup so `auth.json`, `world.json`, `players/`, and the other JSON files
   are directly beneath the configured `DATA_DIR`.
5. Preserve ownership and restrict access to the service account.
6. Start one server process and inspect startup/persistence logs.
7. Verify an existing account login, profile inventory, world edits, containers, teams,
   guilds, and a reconnect save cycle before reopening traffic.

If validation fails, stop the process, restore the rollback directory, and investigate
on a copy. Never repair corrupt profiles by replacing them with defaults; the server
deliberately fails those reads to avoid destroying recoverable data.

## Firebase backup and restore

Use managed Firestore export/import with a versioned Cloud Storage destination and a
service account authorized for Firestore export operations. Follow the current Google
Cloud procedure for the project and record the export identifier, timestamp, database,
and application release.

A complete Firebase deployment backup has two parts:

1. the Firestore export containing world and player documents; and
2. a stopped, consistent backup of `DATA_DIR`, especially `auth.json` and moderation
   reports.

For restore, keep the game offline, import Firestore into the intended project/database,
restore `DATA_DIR`, verify credential/project configuration, then start exactly one game
server. Test account ownership and player/world consistency before reopening traffic.
Firestore export alone cannot restore logins because authentication is not stored there.

## Recovery objectives and drills

Choose retention, recovery point objective, and recovery time objective appropriate to
the deployment. At minimum, automate daily backups, retain several generations, alert
on backup failure, and perform a documented isolated restore drill after storage/schema
changes. A backup is not considered valid until its checksum and restoration have both
been tested.
