import { Command } from 'commander';
import chalk from 'chalk';
import {
  loadClaudeConfig,
  removeClaudeServer,
  saveClaudeConfig,
} from '../services/claude.js';
import {
  loadProjectConfig,
  removeProjectServer,
  saveProjectConfig,
} from '../services/project.js';

export function registerRemoveCommand(program: Command): void {
  program
    .command('remove <server>')
    .description('Remove an MCP server from a config target')
    .option('--project', 'Remove from mcpkg.json')
    .option('--claude', 'Remove from Claude Desktop config')
    .action(async (serverName: string, options: { project?: boolean; claude?: boolean }) => {
      try {
        const targets = resolveTargets(options);

        for (const target of targets) {
          if (target === 'project') {
            await removeFromProject(serverName);
          } else {
            await removeFromClaude(serverName);
          }
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

  return ['project'];
}

async function removeFromProject(serverName: string): Promise<void> {
  const config = await loadProjectConfig();
  if (!config.mcpServers?.[serverName]) {
    console.log(chalk.yellow(`Project config does not contain "${serverName}".`));
    return;
  }

  await saveProjectConfig(removeProjectServer(config, serverName));
  console.log(chalk.green(`Removed ${serverName} from mcpkg.json`));
}

async function removeFromClaude(serverName: string): Promise<void> {
  const config = await loadClaudeConfig();
  if (!config.mcpServers?.[serverName]) {
    console.log(chalk.yellow(`Claude Desktop config does not contain "${serverName}".`));
    return;
  }

  await saveClaudeConfig(removeClaudeServer(config, serverName));
  console.log(chalk.green(`Removed ${serverName} from Claude Desktop config`));
}
