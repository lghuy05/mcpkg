import { ClientMcpConfig } from '../types/mcp.js';

export type DuplicateCheck =
  | { kind: 'none' }
  | { kind: 'same-key'; existingKey: string }
  | { kind: 'same-runtime'; existingKey: string };

export function findDuplicateServer(
  servers: Record<string, ClientMcpConfig>,
  serverKey: string,
  config: ClientMcpConfig
): DuplicateCheck {
  if (servers[serverKey]) {
    return {
      kind: 'same-key',
      existingKey: serverKey,
    };
  }

  const runtimeKey = runtimeFingerprint(config);
  const match = Object.entries(servers).find(([, existingConfig]) => {
    return runtimeFingerprint(existingConfig) === runtimeKey;
  });

  if (match) {
    return {
      kind: 'same-runtime',
      existingKey: match[0],
    };
  }

  return { kind: 'none' };
}

function runtimeFingerprint(config: ClientMcpConfig): string {
  if ('command' in config) {
    // Ignore npx's confirmation flag so the same package is not duplicated
    // just because one config used "-y" and another omitted it.
    return [
      'local',
      config.command,
      ...normalizeArgs(config.args),
    ].join('\0');
  }

  return [
    'remote',
    config.type.toLowerCase(),
    config.url,
  ].join('\0');
}

function normalizeArgs(args: string[]): string[] {
  return args.filter((arg) => arg !== '-y' && arg !== '--yes');
}
