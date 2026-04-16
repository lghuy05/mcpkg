import { ClientMcpConfig, ProjectMcpConfig } from '../types/mcp.js';

export function parseMcpConfig(raw: string, sourceName: string): ProjectMcpConfig {
  if (raw.trim() === '') {
    return { mcpServers: {} };
  }

  const parsed = JSON.parse(raw) as unknown;
  return normalizeMcpConfig(parsed, sourceName);
}

export function normalizeMcpConfig(value: unknown, sourceName: string): ProjectMcpConfig {
  if (!isRecord(value)) {
    throw new Error(`${sourceName} must contain a JSON object`);
  }

  const rawServers = value.mcpServers;
  if (rawServers === undefined) {
    return {
      ...value,
      mcpServers: {},
    } as ProjectMcpConfig;
  }

  if (!isRecord(rawServers)) {
    throw new Error(`${sourceName}.mcpServers must be an object`);
  }

  const mcpServers: Record<string, ClientMcpConfig> = {};
  for (const [name, config] of Object.entries(rawServers)) {
    if (!isClientMcpConfig(config)) {
      throw new Error(`${sourceName}.mcpServers["${name}"] is not a valid MCP config`);
    }

    mcpServers[name] = config;
  }

  return {
    ...value,
    mcpServers,
  } as ProjectMcpConfig;
}

function isClientMcpConfig(value: unknown): value is ClientMcpConfig {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.command === 'string' && Array.isArray(value.args)) {
    return value.args.every((arg) => typeof arg === 'string');
  }

  return typeof value.type === 'string' && typeof value.url === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
