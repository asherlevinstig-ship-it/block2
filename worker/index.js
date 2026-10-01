const GAME_PREFIX = "/game";
const COLYSEUS_ORIGIN = "https://us-mia-ea26ba04.colyseus.cloud";

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
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === GAME_PREFIX || url.pathname.startsWith(`${GAME_PREFIX}/`)) {
      if (!isAllowedGameRequest(request)) return new Response("Not found", { status: 404 });
      const upstream = colyseusUpstreamUrl(request.url);
      return fetch(new Request(upstream, request));
    }
    return env.ASSETS.fetch(request);
  },
};
