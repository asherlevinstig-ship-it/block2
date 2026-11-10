import { handleAccountApi } from "../pocket-lobby/server/accounts.mjs";
import { handleWorldConnect, SharedRoom } from "../pocket-lobby/server/shared-room.mjs";
export { SharedRoom };
import {AutoActor,AutoDirector,syncAutoActor,wakeAutoDirector} from '../pocket-lobby/server/auto-actor.mjs';
export {AutoActor,AutoDirector};
import { handlePlayerApi } from "../pocket-lobby/server/player-api.mjs";

const GAME_PREFIX = "/game";
const COLYSEUS_ORIGIN = "https://us-mia-ea26ba04.colyseus.cloud";
const LEGACY_ASSET_REDIRECTS = new Map([
  ["/assets/index-DOyyG1l4.css", "/assets/index.css"],
  ["/assets/index-BZDvdp8L.css", "/assets/index.css"],
  ["/assets/index-QH2u70CO.js", "/assets/game.js"],
]);

export function colyseusUpstreamUrl(requestUrl) {
  const incoming = new URL(requestUrl);
  const upstream = new URL(COLYSEUS_ORIGIN);
  upstream.pathname = incoming.pathname.slice(GAME_PREFIX.length) || "/";
  upstream.search = incoming.search;
  return upstream;
}

export function isAllowedGameRequest(request) {
  const url = new URL(request.url);
  const upgrade = request.headers.get("Upgrade")?.toLowerCase();
  return url.pathname === `${GAME_PREFIX}/health`
    || url.pathname.startsWith(`${GAME_PREFIX}/matchmake/`)
    || upgrade === "websocket";
}

export default {
  async scheduled(controller,env,ctx){ctx.waitUntil(wakeAutoDirector(env));},
  async fetch(request, env) {
    const url = new URL(request.url);
    if(url.pathname.startsWith("/api/account/"))return handleAccountApi(request,env);
    if(url.pathname==="/api/world/connect")return handleWorldConnect(request,env);
    if(url.pathname.startsWith("/api/player/"))return syncAutoActor(env,await handlePlayerApi(request,env));
    const currentAsset = LEGACY_ASSET_REDIRECTS.get(url.pathname);
    if (currentAsset) {
      url.pathname = currentAsset;
      return Response.redirect(url, 307);
    }
    if (url.pathname === GAME_PREFIX || url.pathname.startsWith(`${GAME_PREFIX}/`)) {
      if (!isAllowedGameRequest(request)) return new Response("Not found", { status: 404 });
      const upstream = colyseusUpstreamUrl(request.url);
      return fetch(new Request(upstream, request));
    }
    return env.ASSETS.fetch(request);
  },
};
