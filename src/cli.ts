import { Command } from 'commander';
import { registerSearchCommand } from './commands/search.js';
import { registerFindCommand } from './commands/find.js';
import { registerInstallCommand } from './commands/install.js';
import { registerListCommand } from './commands/list.js';
import { registerRemoveCommand } from './commands/remove.js';
import { registerGuideCommand } from './commands/guide.js';
import { registerSetupCommand } from './commands/setup.js';

export function buildCli(): Command {
  const program = new Command();

  program
    .name('mcpkg')
    .description('Community package manager for MCP servers')
    .version('1.0.0')
    .addHelpText('after', '\nRun "mcpkg guide" for the recommended workflow.\n');

  registerGuideCommand(program);
  registerSetupCommand(program);
  registerSearchCommand(program);
  registerFindCommand(program);
  registerInstallCommand(program);
  registerListCommand(program);
  registerRemoveCommand(program);

  return program;
}
