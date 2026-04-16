import { Command } from 'commander';
import { MCPKG_GUIDE } from '../utils/guide.js';

export function registerGuideCommand(program: Command): void {
  program
    .command('guide')
    .description('Show a practical guide for using mcpkg')
    .action(() => {
      console.log(MCPKG_GUIDE);
    });
}
