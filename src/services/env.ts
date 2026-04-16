import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { applyUserConfigToEnv, loadUserConfigSync } from './userConfig.js';

let loaded = false;

export function loadLocalEnv(cwd: string = process.cwd()): void {
  if (loaded) {
    return;
  }

  loaded = true;
  applyUserConfigToEnv(loadUserConfigSync());

  const candidatePaths = [
    path.join(cwd, '.env'),
    path.join(os.homedir(), '.mcpkg', '.env'),
    path.join(os.homedir(), '.env'),
  ];

  for (const envPath of candidatePaths) {
    if (!existsSync(envPath)) {
      continue;
    }

    const raw = readFileSync(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const separator = trimmed.indexOf('=');
      if (separator === -1) {
        continue;
      }

      const key = trimmed.slice(0, separator).trim();
      const value = stripQuotes(trimmed.slice(separator + 1).trim());

      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
