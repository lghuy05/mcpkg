import { Command } from 'commander';
import chalk from 'chalk';
import { loadClaudeConfig } from '../services/claude.js';
import { loadProjectConfig } from '../services/project.js';
import { ClientMcpConfig } from '../types/mcp.js';

export function registerListCommand(program: Command): void {
  program
    .command('list')
    .description('List MCP servers configured by mcpkg')
    .option('--project', 'List servers in mcpkg.json')
    .option('--claude', 'List servers in Claude Desktop config')
    .action(async (options: { project?: boolean; claude?: boolean }) => {
      try {
        const targets = resolveTargets(options);

        for (const target of targets) {
          const config = target === 'claude' ? await loadClaudeConfig() : await loadProjectConfig();
          printServers(target, config.mcpServers ?? {});
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(chalk.red(`Error: ${message}`));
      }
    });
}

function resolveTargets(options: { project?: boolean; claude?: boolean }): Array<'project' | 'claude'> {
  if (options.project || options.claude) {
    return [
      ...(options.project ? ['project' as const] : []),
      ...(options.claude ? ['claude' as const] : []),
    ];
  }

  return ['project', 'claude'];
}

function printServers(target: 'project' | 'claude', servers: Record<string, ClientMcpConfig>): void {
  const names = Object.keys(servers);
  const label = target === 'claude' ? 'Claude Desktop' : 'Project';

  console.log('');
  console.log(chalk.bold(`${label} servers`));

  if (names.length === 0) {
    console.log(chalk.gray('  none'));
    return;
  }

  for (const name of names.sort()) {
    const config = servers[name];
    const runtime = 'command' in config
      ? `local ${config.command} ${config.args.join(' ')}`
      : `remote ${config.type} ${config.url}`;

    console.log(chalk.green(`  ${name}`));
    console.log(chalk.dim(`    ${runtime}`));
  }
}
