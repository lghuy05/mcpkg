import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveInstallPlan } from '../installResolver.js';
import { InstallPlan, InstallRequirement, McpServer } from '../../types/mcp.js';

const server: McpServer = {
  name: 'example/postgres',
};

test('asks for unanswered README-derived requirements', () => {
  const plan: InstallPlan = {
    kind: 'local-config',
    summary: 'Run example server',
    config: {
      command: 'npx',
      args: ['-y', '@example/postgres'],
    },
  };

  const requirements: InstallRequirement[] = [
    {
      kind: 'env',
      key: 'env:DATABASE_URL',
      label: 'DATABASE_URL',
      prompt: 'Enter PostgreSQL connection string',
      source: 'readme',
      confidence: 'high',
      required: true,
      secret: true,
    },
  ];

  const resolution = resolveInstallPlan(server, plan, {}, requirements);

  assert.equal(resolution.questions.length, 1);
  assert.equal(resolution.questions[0].key, 'env:DATABASE_URL');
  assert.equal(resolution.questions[0].message, 'Enter PostgreSQL connection string [readme/high]');
});

test('applies env answers into local MCP config', () => {
  const plan: InstallPlan = {
    kind: 'local-config',
    summary: 'Run example server',
    config: {
      command: 'npx',
      args: ['-y', '@example/postgres'],
    },
  };

  const requirements: InstallRequirement[] = [
    {
      kind: 'env',
      key: 'env:DATABASE_URL',
      label: 'DATABASE_URL',
      prompt: 'Enter PostgreSQL connection string',
      source: 'readme',
      confidence: 'high',
      required: true,
      secret: true,
    },
  ];

  const resolution = resolveInstallPlan(
    server,
    plan,
    { 'env:DATABASE_URL': 'postgresql://user:pass@localhost:5432/db' },
    requirements
  );

  assert.deepEqual(resolution.config, {
    command: 'npx',
    args: ['-y', '@example/postgres'],
    env: {
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    },
  });
});

test('applies remote variables and headers into remote MCP config', () => {
  const remoteServer: McpServer = {
    name: 'example/remote',
    remotes: [
      {
        type: 'streamable-http',
        url: 'https://example.com/{tenant}/mcp',
      },
    ],
  };
  const plan: InstallPlan = {
    kind: 'remote-config',
    summary: 'Connect to remote server',
    config: {
      type: 'streamable-http',
      url: 'https://example.com/{tenant}/mcp',
    },
  };

  const requirements: InstallRequirement[] = [
    {
      kind: 'variable',
      key: 'variable:tenant',
      label: 'tenant',
      prompt: 'Enter tenant',
      source: 'registry',
      confidence: 'high',
      required: true,
    },
    {
      kind: 'header',
      key: 'header:Authorization',
      label: 'Authorization',
      prompt: 'Enter bearer token',
      source: 'registry',
      confidence: 'high',
      required: true,
      secret: true,
    },
  ];

  const resolution = resolveInstallPlan(
    remoteServer,
    plan,
    {
      'variable:tenant': 'acme',
      'header:Authorization': 'Bearer token',
    },
    requirements
  );

  assert.deepEqual(resolution.config, {
    type: 'streamable-http',
    url: 'https://example.com/acme/mcp',
    headers: {
      Authorization: 'Bearer token',
    },
  });
});
