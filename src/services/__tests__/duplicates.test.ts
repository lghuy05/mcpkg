import test from 'node:test';
import assert from 'node:assert/strict';
import { findDuplicateServer } from '../duplicates.js';

test('detects an exact server key duplicate', () => {
  const result = findDuplicateServer(
    {
      postgres: {
        command: 'npx',
        args: ['-y', '@example/postgres'],
      },
    },
    'postgres',
    {
      command: 'npx',
      args: ['-y', '@example/postgres'],
    }
  );

  assert.deepEqual(result, {
    kind: 'same-key',
    existingKey: 'postgres',
  });
});

test('detects same npx package under a different server key', () => {
  const result = findDuplicateServer(
    {
      postgres: {
        command: 'npx',
        args: ['-y', '@example/postgres'],
      },
    },
    'io.github.example/postgres',
    {
      command: 'npx',
      args: ['@example/postgres'],
    }
  );

  assert.deepEqual(result, {
    kind: 'same-runtime',
    existingKey: 'postgres',
  });
});

test('does not flag different runtimes as duplicates', () => {
  const result = findDuplicateServer(
    {
      postgres: {
        command: 'npx',
        args: ['-y', '@example/postgres'],
      },
    },
    'filesystem',
    {
      command: 'npx',
      args: ['-y', '@example/filesystem'],
    }
  );

  assert.deepEqual(result, { kind: 'none' });
});
