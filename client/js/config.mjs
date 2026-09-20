const DEFAULT_BACKEND_URL = 'https://us-mia-ea26ba04.colyseus.cloud';

function cleanUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function pageBackendUrl() {
  try {
    const params = new URLSearchParams(location.search);
    return cleanUrl(params.get('backend'));
  } catch (_) {
    return '';
  }
}

function sameOriginBackendHost() {
  const hostname=String(location&&location.hostname||'').toLowerCase();
  if(hostname==='localhost'||hostname==='127.0.0.1'||hostname==='[::1]')return true;
  try{return hostname===new URL(DEFAULT_BACKEND_URL).hostname.toLowerCase();}
  catch(_){return false;}
}

export function backendHttpUrl() {
  const explicit = cleanUrl(globalThis.BlockcraftConfig && globalThis.BlockcraftConfig.backendUrl) || pageBackendUrl();
  if (explicit) return explicit;
  return sameOriginBackendHost()?'':DEFAULT_BACKEND_URL;
}

export function backendWsUrl() {
  const httpUrl = backendHttpUrl();
  if (httpUrl) return httpUrl.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
  return (location.protocol === 'https:' ? 'wss' : 'ws') + '://' + location.host;
}

export function apiUrl(path) {
  const base = backendHttpUrl();
  return base ? base + path : path;
}
