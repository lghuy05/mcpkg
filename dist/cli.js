import { Command } from 'commander';
import { registerSearchCommand } from './commands/search.js';
import { registerInstallCommand } from './commands/install.js';
export function buildCli() {
    const program = new Command();
    program
        .name('mcpkg')
        .description('Community package manager for MCP servers')
        .version('1.0.0');
    registerSearchCommand(program);
    registerInstallCommand(program);
    return program;
}
