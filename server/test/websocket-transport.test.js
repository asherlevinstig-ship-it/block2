const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_MAX_PAYLOAD_BYTES,
  MAX_MAX_PAYLOAD_BYTES,
  MIN_MAX_PAYLOAD_BYTES,
  websocketMaxPayload,
  websocketTransportOptions,
} = require('../websocket-transport');

test('websocket payload limit is explicit and bounded', () => {
  assert.equal(websocketMaxPayload({}), DEFAULT_MAX_PAYLOAD_BYTES);
  assert.equal(websocketMaxPayload({ BLOCKCRAFT_WS_MAX_PAYLOAD_BYTES: '12000' }), 12000);
  assert.equal(websocketMaxPayload({ BLOCKCRAFT_WS_MAX_PAYLOAD_BYTES: '1' }), MIN_MAX_PAYLOAD_BYTES);
  assert.equal(websocketMaxPayload({ BLOCKCRAFT_WS_MAX_PAYLOAD_BYTES: '999999' }), MAX_MAX_PAYLOAD_BYTES);
  assert.equal(websocketMaxPayload({ BLOCKCRAFT_WS_MAX_PAYLOAD_BYTES: 'invalid' }), DEFAULT_MAX_PAYLOAD_BYTES);
});

test('transport keeps compression disabled and accepts an existing server', () => {
  const server = { name: 'test-server' };
  assert.deepEqual(websocketTransportOptions({}, { server }), {
    server,
    maxPayload: DEFAULT_MAX_PAYLOAD_BYTES,
    perMessageDeflate: false,
  });
});
