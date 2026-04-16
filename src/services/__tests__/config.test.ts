import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMcpConfig } from '../config.js';

test('empty config files load as an empty mcpServers object', () => {
  assert.deepEqual(parseMcpConfig('', 'test.json'), {
    mcpServers: {},
  });
});

test('missing mcpServers is normalized for existing Claude config files', () => {
  assert.deepEqual(parseMcpConfig('{"theme":"dark"}', 'test.json'), {
    theme: 'dark',
    mcpServers: {},
  });
});

test('valid local and remote server configs are preserved', () => {
  const parsed = parseMcpConfig(
    JSON.stringify({
      mcpServers: {
        local: {
          command: 'npx',
          args: ['-y', '@example/server'],
        },
        remote: {
          type: 'streamable-http',
          url: 'https://example.com/mcp',
        },
      },
    }),
    'test.json'
  );

  assert.deepEqual(Object.keys(parsed.mcpServers), ['local', 'remote']);
});

test('invalid mcpServers shape fails clearly', () => {
  assert.throws(
    () => parseMcpConfig('{"mcpServers":[]}', 'test.json'),
    /test\.json\.mcpServers must be an object/
  );
});

test('invalid server config fails clearly', () => {
  assert.throws(
    () => parseMcpConfig('{"mcpServers":{"bad":{"command":"npx"}}}', 'test.json'),
    /test\.json\.mcpServers\["bad"\] is not a valid MCP config/
  );
});
