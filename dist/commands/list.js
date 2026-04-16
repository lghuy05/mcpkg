import chalk from 'chalk';
import { loadClaudeConfig } from '../services/claude.js';
import { loadProjectConfig } from '../services/project.js';
export function registerListCommand(program) {
    program
        .command('list')
        .description('List MCP servers configured by mcpkg')
        .option('--project', 'List servers in mcpkg.json')
        .option('--claude', 'List servers in Claude Desktop config')
        .action(async (options) => {
        try {
            const targets = resolveTargets(options);
            for (const target of targets) {
                const config = target === 'claude' ? await loadClaudeConfig() : await loadProjectConfig();
                printServers(target, config.mcpServers ?? {});
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error(chalk.red(`Error: ${message}`));
        }
    });
}
function resolveTargets(options) {
    if (options.project || options.claude) {
        return [
            ...(options.project ? ['project'] : []),
            ...(options.claude ? ['claude'] : []),
        ];
    }
    return ['project', 'claude'];
}
function printServers(target, servers) {
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
