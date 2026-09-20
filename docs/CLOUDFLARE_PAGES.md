# Cloudflare Workers static frontend

Blockcraft's browser client is a static site. Cloudflare Workers Static Assets serves it; the
authoritative Node/Colyseus process remains at the existing backend URL because it
owns game state, authentication endpoints, and long-lived WebSocket connections.
Do not deploy `server/` in the Worker or create a second game server replica.

## Configure the Worker

The existing production Worker is `block2`. Connect it to this repository and use:

| Setting | Value |
| --- | --- |
| Worker name | `block2` |
| Production branch | `main` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Root directory | repository root |
| Environment variable | `NODE_VERSION=20` |

`wrangler.toml` deploys `dist` as the Worker's static asset directory. `client/_headers`
is copied into `dist` by the build and provides Worker-native security/cache headers.
Cloudflare's clean-URL handling serves `register.html` at `/register` without a custom
rewrite. Every push to `main` produces a production deployment when Workers Builds is
connected; other enabled branches produce preview versions.

The same project can be deployed manually after `npx wrangler login`:

```bash
npm run deploy:cloudflare
```

## Connect the browser to Colyseus

The production client defaults to:

```text
https://us-mia-ea26ba04.colyseus.cloud
```

Any non-local frontend host—including `*.workers.dev` and a custom domain—uses that
backend for HTTP and WebSocket traffic. Localhost and the Colyseus host itself keep
same-origin behavior. `?backend=https://another-host.example` remains available for
controlled testing.

On the Colyseus deployment, authorize the exact new frontend origin:

```env
CLIENT_ORIGINS=https://block2.vercel.app,https://block2.asherlevin85.workers.dev
```

Keep both origins only during cutover. After Cloudflare passes validation and the
old site is no longer receiving players, remove the Vercel origin and restart the
single Colyseus process gracefully. If a custom domain is attached, use that exact
origin instead (or add it during the transition). Preview domains are different
origins and will not be able to authenticate unless explicitly authorized.

## Login handoff and custom domain

Update the Liveweave/SiteGround login redirect target from the Vercel URL to the
Worker production URL or custom domain:

```text
https://block2.asherlevin85.workers.dev/?auth_token=<short-lived-random-token>
```

Attach the final hostname under **Worker > Settings > Domains & Routes**, wait for TLS to become
active, then update both the Liveweave redirect and `CLIENT_ORIGINS` to that hostname.
The client automatically uses the Liveweave login flow on hosted frontend domains.

## Cutover checklist

1. Deploy the Worker from `main` and open `https://block2.asherlevin85.workers.dev`.
2. Confirm `/build-info.json` returns the Cloudflare commit SHA and is not cached.
3. Confirm `/register` renders `register.html` without changing the address.
4. Sign in through Liveweave and verify the handoff token disappears from the URL.
5. Join the overworld and confirm the browser opens a secure WebSocket to the
   Colyseus hostname, not to `workers.dev`.
6. Test reconnect, inventory persistence, a dungeon transition, and a bug report.
7. Attach the custom domain and repeat the smoke test there.
8. Change external login links and DNS/marketing links to the new hostname.
9. Retain the old deployment briefly as a redirect/rollback, then disable it and
   remove its origin from the backend allowlist.

Rollback is DNS/link-only: point users back to the prior frontend and restore its
exact origin in `CLIENT_ORIGINS`. Do not roll back or duplicate persistent game
servers merely to roll back the static client.
