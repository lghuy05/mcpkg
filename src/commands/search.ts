import { Command } from 'commander';
import chalk from 'chalk';
import { searchRegistry } from '../services/registry.js';
import { printSearchResults } from '../utils/output.js';
import { sortServersByScore } from '../services/ranking.js';

export function registerSearchCommand(program: Command): void {
  program
    .command('search <query>')
    .description('Search for MCP servers')
    .action(async (query: string) => {
      console.log(chalk.blue(`🔍 Searching for "${query}"...`));

      try {
        const entries = await searchRegistry(query);
        const ranked = sortServersByScore(entries, query);
        printSearchResults(query, ranked);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(chalk.red(`❌ Error: ${message}`));
      }
    });
}
