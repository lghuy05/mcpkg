import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { searchRegistry } from '../services/registry.js';
import { promptForInstallQuestions } from '../services/prompts.js';
import { createInstallPlan } from '../services/planner.js';
import { upsertProjectServer, loadProjectConfig, saveProjectConfig } from '../services/project.js';
import { loadClaudeConfig, saveClaudeConfig, upsertClaudeServer } from '../services/claude.js';
import { findExactEntry, hasClearlyDominantMatch, pickBestServer } from '../services/select.js';
import { resolveInstallPlan } from '../services/installResolver.js';
import { analyzeInstallRequirements } from '../services/installRequirementAnalyzer.js';
import { suggestInstallRetry } from '../services/installRetryAgent.js';
import { verifyConfig } from '../services/verify.js';
import { loadLocalEnv } from '../services/env.js';
import { suggestAlternativeServers } from '../services/alternatives.js';
import { printAlternativeRecommendations, printVerificationResult } from '../utils/output.js';
import { ClientMcpConfig } from '../types/mcp.js';
import { findDuplicateServer } from '../services/duplicates.js';

interface InstallOptions {
  claude?: boolean;
  project?: boolean;
  force?: boolean;
}

export function registerInstallCommand(program: Command): void {
  program
    .command('install <server>')
    .description('Resolve an MCP server into a usable setup plan')
    .option('--project', "Write MCP config to mcpkg.json in the current project")
    .option('--claude', "Write MCP config Claude desktop")
    .option('--force', 'Replace an existing server config if one already exists')
    .action(async (serverName: string, options: InstallOptions) => {
      loadLocalEnv();
      const spinner = ora(`Fetching info for "${serverName}"...`).start();

      try {
        const entries = await searchRegistry(serverName);
        spinner.stop();
        if (entries.length === 0) {
          console.log(chalk.red(`No server found for "${serverName}"`));
          return;
        }

        const exact = findExactEntry(entries, serverName);
        if (!exact && !hasClearlyDominantMatch(entries, serverName)) {
          console.log(chalk.yellow(`Multiple servers match "${serverName}".`));
          console.log(chalk.gray(`Try: mcpkg search "${serverName}"`));
          console.log(chalk.gray(`Or:  mcpkg find "${serverName}"`));
          return;
        }

        const selectedEntry = await pickBestServer(entries, serverName);
        if (!selectedEntry) {
          console.log(chalk.red(`No installable server found for "${serverName}"`));
          return;
        }

        console.log(chalk.dim(`selected: ${selectedEntry.server.name}`));
        const plan = createInstallPlan(selectedEntry.server);
        const requirements = await analyzeInstallRequirements(selectedEntry.server);
        const answers: Record<string, string> = {};
        let resolution = resolveInstallPlan(selectedEntry.server, plan, answers, requirements);

        if (resolution.questions.length > 0) {
          Object.assign(answers, await promptForInstallQuestions(resolution.questions));
          resolution = resolveInstallPlan(selectedEntry.server, plan, answers, requirements);
        }

        if (resolution.kind === 'manual' || !resolution.config) {
          console.log(chalk.yellow(resolution.summary));
          resolution.manualSteps?.forEach((step, index) => {
            console.log(chalk.gray(`${index + 1}. ${step}`));
          });
          return;
        }

        let verification = await verifyConfig(resolution.config);
        printVerificationResult(verification);

        if (!verification.ok) {
          const retryDecision = await suggestInstallRetry(
            selectedEntry.server,
            resolution.config,
            verification
          );

          if (retryDecision.kind === 'fail') {
            console.log(chalk.yellow(retryDecision.reason));
            const alternatives = await suggestAlternativeServers(
              selectedEntry.server,
              serverName
            );
            printAlternativeRecommendations(alternatives);
            console.log(chalk.yellow('Not written: verification failed.'));
            return;
          }

          console.log(chalk.dim(`retry: ${retryDecision.reason}`));
          Object.assign(
            answers,
            await promptForInstallQuestions([retryDecision.question])
          );
          resolution = resolveInstallPlan(selectedEntry.server, plan, answers, requirements);

          if (resolution.kind === 'manual' || !resolution.config) {
            console.log(chalk.yellow('Retry could not produce a valid config.'));
            return;
          }

          verification = await verifyConfig(resolution.config);
          printVerificationResult(verification);

          if (!verification.ok) {
            console.log(chalk.yellow('Install stopped after one agent-guided retry.'));
            const alternatives = await suggestAlternativeServers(
              selectedEntry.server,
              serverName
            );
            printAlternativeRecommendations(alternatives);
            return;
          }
        }

        if (options.project) {
          const currentConfig = await loadProjectConfig();
          if (hasDuplicate(currentConfig.mcpServers ?? {}, selectedEntry.server.name, resolution.config, options)) {
            return;
          }

          const updatedConfig = upsertProjectServer(currentConfig, selectedEntry.server.name, resolution.config);
          await saveProjectConfig(updatedConfig);
          console.log(chalk.green(`Added ${selectedEntry.server.name} to mcpkg.json`));
          return;
        }

        if (options.claude) {
          const currentConfig = await loadClaudeConfig();
          if (hasDuplicate(currentConfig.mcpServers ?? {}, selectedEntry.server.name, resolution.config, options)) {
            return;
          }

          const updatedConfig = upsertClaudeServer(currentConfig, selectedEntry.server.name, resolution.config);
          await saveClaudeConfig(updatedConfig);
          console.log(chalk.green(`Added ${selectedEntry.server.name} to Claude Desktop config`));
          return;
        }

        console.log(chalk.yellow('Choose a config target with --project or --claude.'));
      } catch (error) {
        spinner.fail('Failed to fetch server');
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(chalk.red(`Error: ${message}`));
      }
    });
}

function hasDuplicate(
  servers: Record<string, ClientMcpConfig>,
  serverKey: string,
  config: ClientMcpConfig,
  options: InstallOptions
): boolean {
  const duplicate = findDuplicateServer(servers, serverKey, config);
  if (duplicate.kind === 'none') {
    return false;
  }

  if (options.force) {
    const action = duplicate.kind === 'same-key' ? 'Replacing' : 'Keeping existing config and adding';
    console.log(chalk.yellow(`${action} "${duplicate.existingKey}".`));
    return false;
  }

  if (duplicate.kind === 'same-key') {
    console.log(chalk.yellow(`Already installed as "${duplicate.existingKey}".`));
  } else {
    console.log(chalk.yellow(`A matching runtime is already installed as "${duplicate.existingKey}".`));
  }

  console.log(chalk.gray(`Use --force to replace, or remove it first:`));
  console.log(chalk.gray(`mcpkg remove "${duplicate.existingKey}" --project`));
  console.log(chalk.gray(`mcpkg remove "${duplicate.existingKey}" --claude`));
  return true;
}
