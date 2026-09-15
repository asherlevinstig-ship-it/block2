const DEFAULT_MAX_PAYLOAD_BYTES = 24 * 1024;
const MIN_MAX_PAYLOAD_BYTES = 4 * 1024;
const MAX_MAX_PAYLOAD_BYTES = 64 * 1024;

function websocketMaxPayload(env = process.env) {
  const configured = Number(env.BLOCKCRAFT_WS_MAX_PAYLOAD_BYTES);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_MAX_PAYLOAD_BYTES;
  return Math.max(MIN_MAX_PAYLOAD_BYTES, Math.min(MAX_MAX_PAYLOAD_BYTES, Math.floor(configured)));
}

function websocketTransportOptions(env = process.env, extra = {}) {
  return {
    ...extra,
    maxPayload: websocketMaxPayload(env),
    perMessageDeflate: false,
  };
}

module.exports = {
  DEFAULT_MAX_PAYLOAD_BYTES,
  MAX_MAX_PAYLOAD_BYTES,
  MIN_MAX_PAYLOAD_BYTES,
  websocketMaxPayload,
  websocketTransportOptions,
};
