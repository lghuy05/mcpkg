import chalk from 'chalk';
import inquirer from 'inquirer';
import { DEFAULT_GEMINI_MODEL, getUserConfigPath, loadUserConfig, saveUserConfig, } from '../services/userConfig.js';
export function registerSetupCommand(program) {
    program
        .command('setup')
        .description('Configure mcpkg user settings')
        .option('--show-path', 'Print the user config path')
        .action(async (options) => {
        try {
            if (options.showPath) {
                console.log(getUserConfigPath());
                return;
            }
            const existing = await loadUserConfig();
            const answers = await promptForSetup(existing);
            const nextConfig = {
                ...existing,
                ...answers,
            };
            await saveUserConfig(nextConfig);
            console.log(chalk.green('Saved mcpkg user config'));
            console.log(chalk.dim(getUserConfigPath()));
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error(chalk.red(`Error: ${message}`));
        }
    });
}
async function promptForSetup(existing) {
    const answers = await inquirer.prompt([
        {
            type: 'password',
            name: 'geminiApiKey',
            message: 'Gemini API key',
            mask: '*',
            default: existing.geminiApiKey ? '<keep existing>' : undefined,
            filter: (value) => {
                const trimmed = value.trim();
                return trimmed === '<keep existing>' ? existing.geminiApiKey : trimmed;
            },
        },
        {
            type: 'input',
            name: 'geminiModel',
            message: 'Gemini model',
            default: existing.geminiModel || DEFAULT_GEMINI_MODEL,
            filter: (value) => value.trim() || DEFAULT_GEMINI_MODEL,
        },
        {
            type: 'input',
            name: 'verifyTimeoutMs',
            message: 'Verification timeout ms',
            default: String(existing.verifyTimeoutMs || 30000),
            validate: (value) => {
                const parsed = Number(value);
                return Number.isFinite(parsed) && parsed > 0
                    ? true
                    : 'Enter a positive number';
            },
            filter: (value) => Number(value),
        },
    ]);
    return answers;
}
