import chalk from 'chalk';
import { loadLocalEnv } from '../services/env.js';
import { findServerWithAgent } from '../services/findAgent.js';
import { printAgentRecommendation } from '../utils/output.js';
export function registerFindCommand(program) {
    program
        .command('find <request>')
        .description('Use an agent to recommend one MCP server from a natural-language request')
        .action(async (request) => {
        loadLocalEnv();
        console.log(chalk.dim(`finding: ${request}`));
        try {
            const recommendation = await findServerWithAgent(request);
            printAgentRecommendation(request, recommendation);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error(chalk.red(`Error: ${message}`));
        }
    });
}
