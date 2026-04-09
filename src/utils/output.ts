import chalk from 'chalk';
import { InstallPlan, McpServer, RegistryServerEntry } from '../types/mcp.js';
import {
  hasPackage,
  hasRemote,
  isActive,
  isLatest,
  isOfficial,
} from '../services/ranking.js';

export function printSearchResults(query: string, entries: RegistryServerEntry[]): void {
  if (entries.length === 0) {
    console.log(chalk.yellow(`No servers found for "${query}"`));
    return;
  }

  console.log(chalk.green(`\nFound ${entries.length} server(s):\n`));

  entries.forEach((entry, index) => {
    const server = entry.server;
    const recommended = index === 0;
    const badges = buildBadges(entry, recommended);

    const titleColor = recommended ? chalk.greenBright.bold : chalk.cyan;

    console.log(titleColor(`${index + 1}. ${server.name}`));

    if (badges.length > 0) {
      console.log(`   ${badges.join(chalk.gray(' • '))}`);
    }

    console.log(
      chalk.gray(`   ${server.description?.substring(0, 120) || 'No description'}`)
    );

    console.log(chalk.dim(`   ${getRuntimeText(entry)}`));

    if (server.id) {
      console.log(chalk.dim(`   ID: ${server.id}`));
    }

    console.log('');
  });
}

export function printServerFound(server: McpServer): void {
  console.log(chalk.green(`Found: ${server.name}`));
  console.log(chalk.gray(`Description: ${server.description || 'No description'}`));
}

export function printInstallPlan(plan: InstallPlan): void {
  console.log(chalk.blue('\nInstall plan'));
  console.log(chalk.gray(`${plan.summary}`));

  if (plan.kind === 'local-config') {
    console.log(chalk.green('\n Local MCP config generated:'));
    console.log(
      JSON.stringify(
        {
          command: plan.config.command,
          args: plan.config.args,
        },
        null,
        2
      )
    );
    return;
  }

  if (plan.kind === 'remote-config') {
    console.log(chalk.green('\n Remote MCP config generated:'));
    console.log(
      JSON.stringify(
        {
          type: plan.config.type,
          url: plan.config.url,
        },
        null,
        2
      )
    );
    return;
  }

  console.log(chalk.yellow('\n Manual setup required:'));
  plan.steps.forEach((step, index) => {
    console.log(chalk.gray(`   ${index + 1}. ${step}`));
  });
}

function buildBadges(entry: RegistryServerEntry, isRecommended: boolean): string[] {
  const badges: string[] = [];

  if (isRecommended) {
    badges.push(chalk.bgGreen.black(' RECOMMENDED '));
  }

  if (isOfficial(entry)) {
    badges.push(chalk.blue('official'));
  }

  if (isLatest(entry)) {
    badges.push(chalk.magenta('latest'));
  }

  if (isActive(entry)) {
    badges.push(chalk.green('active'));
  }

  if (hasRemote(entry)) {
    badges.push(chalk.cyan('remote'));
  } else if (hasPackage(entry)) {
    badges.push(chalk.yellow('local'));
  }

  return badges;
}

function getRuntimeText(entry: RegistryServerEntry): string {
  const server = entry.server;

  if (server.remotes?.length) {
    const remote = server.remotes[0];
    return `🌐 ${remote.type.toUpperCase()} · ${remote.url}`;
  }

  if (server.packages?.length) {
    const pkg = server.packages[0];
    const transport = pkg.transport?.type ?? 'unknown';
    return `🖥 ${pkg.registryType} · ${transport} · ${pkg.identifier}`;
  }

  if (server.repository?.url) {
    return `📦 repo · ${server.repository.url}`;
  }

  return 'Unknown runtime';
}

