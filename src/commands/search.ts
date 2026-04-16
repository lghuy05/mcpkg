import { Command } from 'commander';
import chalk from 'chalk';
import { searchRegistry } from '../services/registry.js';
import { printSearchResults, printServerDetails } from '../utils/output.js';
import { sortServersByScore } from '../services/ranking.js';

export function registerSearchCommand(program: Command): void {
  program
    .command('search <query>')
    .description('Search registry metadata for MCP servers')
    .action(async (query: string) => {
      console.log(chalk.dim(`searching: ${query}`));

      try {
        const entries = await searchRegistry(query);
        const exact = findExactEntry(entries, query);

        if (exact) {
          printServerDetails(exact);
          return;
        }

        const ranked = sortServersByScore(dedupeEntries(entries), query);
        printSearchResults(query, ranked);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(chalk.red(`Error: ${message}`));
      }
    });
}

function dedupeEntries(queryResults: Awaited<ReturnType<typeof searchRegistry>>) {
  const seen = new Set<string>();

  return queryResults.filter((entry) => {
    const key = entry.server.id || entry.server.name;
    if (!key) {
      return true;
    }

    const normalized = key.toLowerCase();
    if (seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });
}

function findExactEntry(queryResults: Awaited<ReturnType<typeof searchRegistry>>, query: string) {
  const normalized = query.trim().toLowerCase();

  return queryResults.find((entry) => {
    const name = entry.server.name?.trim().toLowerCase();
    const id = entry.server.id?.trim().toLowerCase();
    return name === normalized || id === normalized;
  }) ?? null;
}
