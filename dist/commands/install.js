import chalk from 'chalk';
import ora from 'ora';
// import { findExactServer } from '../services/registry.js';
import { searchRegistry } from '../services/registry.js';
import { promptUserSelection } from '../services/select.js';
import { createInstallPlan } from '../services/planner.js';
import { upsertProjectServer, loadProjectConfig } from '../services/project.js';
import { writeFile } from 'node:fs/promises';
export function registerInstallCommand(program) {
    program
        .command('install <server>')
        .description('Resolve an MCP server into a usable setup plan')
        .option('--project', "Write MCP config to mcpkg.json in the current project")
        .action(async (serverName, options) => {
        const spinner = ora(`Fetching info for "${serverName}"...`).start();
        try {
            // const server = await findExactServer(serverName);
            const entries = await searchRegistry(serverName);
            spinner.stop();
            if (entries.length === 0) {
                console.log(chalk.red(`❌ No server found for "${serverName}"`));
                return;
            }
            const exactMatch = entries.find((entry) => {
                return entry.server.name.toLowerCase() === serverName.trim().toLowerCase();
            });
            let selectedEntry;
            if (exactMatch) {
                selectedEntry = exactMatch;
            }
            else {
                selectedEntry = await promptUserSelection(entries);
            }
            console.log(chalk.cyan(`User selected: ${selectedEntry.server.name}`));
            const plan = createInstallPlan(selectedEntry.server);
            //TODO: apiKey, should be provide via argument (however, better improvement should be have a seperate prompt for user to paste in apiKey) 
            if (options.project) {
                if (plan.kind === "local-config") {
                    // const raw = await readFile('mcpkg.json', 'utf8');
                    const currentConfig = await loadProjectConfig();
                    const updatedConfig = upsertProjectServer(currentConfig, selectedEntry.server.name, plan.config);
                    await writeFile('mcpkg.json', JSON.stringify(updatedConfig, null, 2), 'utf8');
                    console.log(`Added ${selectedEntry.server.name}`);
                }
                else if (plan.kind === "remote-config") {
                    console.log("Project install for remote MCP servers is not supported yet.");
                    console.log(`Remote URL: ${plan.config.url}`);
                }
                else {
                    // cannot write project config
                    console.log("This server requires manual setup and cannot be written to mcpkg.json yet.");
                    return;
                }
            }
        }
        catch (error) {
            spinner.fail('Failed to fetch server');
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error(chalk.red(`Error: ${message}`));
        }
    });
}
