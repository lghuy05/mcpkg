#!/usr/bin/env node
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'mcpkg-smoke-'));
const packDir = path.join(tempRoot, 'pack');
const installPrefix = path.join(tempRoot, 'install');
const npmCache = path.join(tempRoot, 'npm-cache');

try {
  await mkdir(packDir, { recursive: true });
  await mkdir(installPrefix, { recursive: true });
  await mkdir(npmCache, { recursive: true });

  run('npm', ['pack', '--pack-destination', packDir], root);

  const tarball = await findTarball(packDir);
  run('npm', ['install', '--no-audit', '--no-fund', '--prefix', installPrefix, tarball], root);

  const bin = process.platform === 'win32'
    ? path.join(installPrefix, 'node_modules', '.bin', 'mcpkg.cmd')
    : path.join(installPrefix, 'node_modules', '.bin', 'mcpkg');

  assertFileExists(bin, 'installed mcpkg binary');

  run(bin, ['--help'], root);
  run(bin, ['guide'], root);
  run(bin, ['setup', '--show-path'], root);

  console.log('Smoke test passed');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    env: {
      ...process.env,
      npm_config_cache: npmCache,
    },
    encoding: 'utf8',
    stdio: 'pipe',
    shell: process.platform === 'win32',
    timeout: 30000,
  });

  if (result.status !== 0) {
    const rendered = [command, ...args].join(' ');
    const reason = result.error?.message ? `\n${result.error.message}` : '';
    throw new Error([
      `Command failed: ${rendered}`,
      reason.trim(),
      result.stdout.trim(),
      result.stderr.trim(),
    ].filter(Boolean).join('\n'));
  }

  return result.stdout;
}

async function findTarball(directory) {
  const file = (await readdir(directory)).find((name) => name.endsWith('.tgz'));
  const tarball = file ? path.join(directory, file) : '';
  assertFileExists(tarball, 'npm pack tarball');
  return tarball;
}

function assertFileExists(filePath, label) {
  if (!existsSync(filePath)) {
    throw new Error(`Missing ${label}: ${filePath}`);
  }
}
