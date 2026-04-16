import chalk from 'chalk';
import { hasPackage, hasRemote, isActive, isLatest, isOfficial, } from '../services/ranking.js';
export function printSearchResults(query, entries) {
    if (entries.length === 0) {
        printEmpty(`No servers found for "${query}"`);
        return;
    }
    printHeader('Search results');
    printKeyValue('query', query);
    printKeyValue('matches', String(entries.length));
    console.log('');
    entries.forEach((entry, index) => {
        const server = entry.server;
        const recommended = index === 0;
        const badges = buildBadges(entry, recommended);
        printCandidate(index + 1, server.name, server.description, getRuntimeText(entry), badges);
        console.log('');
    });
}
export function printRecommendation(query, recommendation) {
    if (!recommendation) {
        printEmpty(`No servers found for "${query}"`);
        return;
    }
    const { entry, rationale } = recommendation;
    const server = entry.server;
    printHeader('Recommendation');
    printKeyValue('request', query);
    printKeyValue('pick', server.name);
    printKeyValue('runtime', getRuntimeText(entry));
    printWrapped('about', server.description || 'No description');
    if (rationale.length > 0) {
        printList('why', rationale);
    }
    printKeyValue('next', `mcpkg install "${server.name}" --claude`);
    console.log('');
}
export function printAgentRecommendation(query, recommendation) {
    if (!recommendation) {
        printEmpty(`No servers found for "${query}"`);
        return;
    }
    if (!recommendation.entry) {
        printEmpty(`No servers found for "${query}"`);
        if (recommendation.rationale.length > 0) {
            printList('reason', recommendation.rationale);
        }
        if (recommendation.searchedTerms && recommendation.searchedTerms.length > 0) {
            printKeyValue('searched', recommendation.searchedTerms.join(', '));
        }
        console.log('');
        return;
    }
    const server = recommendation.entry.server;
    const source = recommendation.source === 'agent' ? 'agent' : 'heuristic';
    printHeader('Recommendation');
    printKeyValue('request', query);
    printKeyValue('pick', `${server.name} ${chalk.dim(`[${source}]`)}`);
    printKeyValue('runtime', getRuntimeText(recommendation.entry));
    printWrapped('about', server.description || 'No description');
    if (recommendation.rationale.length > 0) {
        printList('why', recommendation.rationale.slice(0, 3));
    }
    if (recommendation.searchedTerms && recommendation.searchedTerms.length > 0) {
        printKeyValue('searched', recommendation.searchedTerms.join(', '));
    }
    const exactKey = server.id || server.name;
    if (exactKey) {
        printKeyValue('inspect', `mcpkg search "${exactKey}"`);
        printKeyValue('install', `mcpkg install "${exactKey}" --claude`);
    }
    console.log('');
}
export function printServerDetails(entry) {
    const server = entry.server;
    const badges = buildBadges(entry, true);
    printHeader(server.name);
    printKeyValue('status', badges.join(' ') || 'registry entry');
    if (server.id) {
        printKeyValue('id', server.id);
    }
    printWrapped('about', server.description || 'No description');
    printKeyValue('runtime', getRuntimeText(entry));
    if (server.repository?.url) {
        printKeyValue('repo', server.repository.url);
    }
    if (server.packages?.length) {
        printSubheader('packages');
        server.packages.forEach((pkg) => {
            const envVars = pkg.environmentVariables?.filter((envVar) => envVar.isRequired).map((envVar) => envVar.name) ?? [];
            const packageArgs = pkg.packageArguments?.filter((arg) => arg.isRequired).map((arg) => arg.name) ?? [];
            console.log(chalk.gray(`  - ${pkg.registryType}/${pkg.transport?.type ?? 'unknown'} ${pkg.identifier}${pkg.version ? `@${pkg.version}` : ''}`));
            if (envVars.length > 0) {
                console.log(chalk.dim(`    env: ${envVars.join(', ')}`));
            }
            if (packageArgs.length > 0) {
                console.log(chalk.dim(`    args: ${packageArgs.join(', ')}`));
            }
        });
    }
    if (server.remotes?.length) {
        printSubheader('remotes');
        server.remotes.forEach((remote) => {
            console.log(chalk.gray(`  - ${remote.type} ${remote.url}`));
        });
    }
    console.log('');
}
export function printServerFound(server) {
    printHeader('Found');
    printKeyValue('server', server.name);
    printWrapped('about', server.description || 'No description');
}
export function printInstallPlan(plan) {
    printHeader('Install plan');
    printWrapped('summary', plan.summary);
    if (plan.kind === 'local-config') {
        printSubheader('local config');
        console.log(JSON.stringify({
            command: plan.config.command,
            args: plan.config.args,
        }, null, 2));
        return;
    }
    if (plan.kind === 'remote-config') {
        printSubheader('remote config');
        console.log(JSON.stringify({
            type: plan.config.type,
            url: plan.config.url,
        }, null, 2));
        return;
    }
    printSubheader('manual setup');
    plan.steps.forEach((step, index) => {
        console.log(chalk.gray(`  ${index + 1}. ${step}`));
    });
}
export function printVerificationResult(result) {
    if (result.ok) {
        printStatus('ok', 'verification', result.message);
        return;
    }
    printStatus('fail', 'verification', result.message);
    if (result.failureKind) {
        printKeyValue('problem', formatFailureKind(result.failureKind));
    }
    result.details?.forEach((detail) => {
        console.log(chalk.dim(`  ${truncate(detail, 180)}`));
    });
}
export function printAlternativeRecommendations(alternatives) {
    if (alternatives.length === 0) {
        printEmpty('No alternative MCP server could be recommended from the registry.');
        return;
    }
    printHeader('Alternatives');
    alternatives.forEach((alternative, index) => {
        const server = alternative.entry.server;
        printCandidate(index + 1, server.name, server.description, getRuntimeText(alternative.entry), []);
        alternative.rationale.slice(0, 2).forEach((reason) => {
            console.log(chalk.dim(`    ${reason}`));
        });
        console.log(chalk.gray(`    install: mcpkg install "${server.name}" --claude`));
    });
}
function formatFailureKind(kind) {
    switch (kind) {
        case 'invalid_stdio_output':
            return 'invalid stdio output';
        case 'invalid_launcher':
            return 'invalid package launcher';
        case 'too_many_arguments':
            return 'too many command arguments';
        case 'missing_input':
            return 'missing required input';
        case 'process_not_found':
            return 'command not found';
        case 'remote_unreachable':
            return 'remote endpoint unreachable';
        case 'process_exited':
            return 'process exited early';
        case 'timeout':
            return 'startup timeout';
        case 'unknown':
            return 'unknown';
    }
}
function buildBadges(entry, isRecommended) {
    const badges = [];
    if (isRecommended) {
        badges.push(chalk.green('[recommended]'));
    }
    if (isOfficial(entry)) {
        badges.push(chalk.blue('[official]'));
    }
    if (isLatest(entry)) {
        badges.push(chalk.magenta('[latest]'));
    }
    if (isActive(entry)) {
        badges.push(chalk.green('[active]'));
    }
    if (hasRemote(entry)) {
        badges.push(chalk.cyan('[remote]'));
    }
    else if (hasPackage(entry)) {
        badges.push(chalk.yellow('[local]'));
    }
    return badges;
}
function getRuntimeText(entry) {
    const server = entry.server;
    if (server.remotes?.length) {
        const remote = server.remotes[0];
        return `remote ${remote.type} ${remote.url}`;
    }
    if (server.packages?.length) {
        const pkg = server.packages[0];
        const transport = pkg.transport?.type ?? 'unknown';
        return `local ${pkg.registryType}/${transport} ${pkg.identifier}`;
    }
    if (server.repository?.url) {
        return `repo ${server.repository.url}`;
    }
    return 'Unknown runtime';
}
function printHeader(title) {
    console.log('');
    console.log(chalk.bold(title));
}
function printSubheader(title) {
    console.log('');
    console.log(chalk.cyan(title));
}
function printKeyValue(key, value) {
    console.log(`${chalk.dim(key.padEnd(9))} ${value}`);
}
function printWrapped(key, value) {
    printKeyValue(key, truncate(value.replace(/\s+/g, ' '), 120));
}
function printList(key, values) {
    if (values.length === 0) {
        return;
    }
    console.log(`${chalk.dim(key.padEnd(9))} ${truncate(values[0], 100)}`);
    values.slice(1).forEach((value) => {
        console.log(`${chalk.dim(''.padEnd(9))} ${truncate(value, 100)}`);
    });
}
function printStatus(kind, label, message) {
    const marker = kind === 'ok'
        ? chalk.green('OK')
        : kind === 'warn'
            ? chalk.yellow('WARN')
            : chalk.red('FAIL');
    console.log(`${marker} ${chalk.bold(label)} ${chalk.dim(truncate(message, 120))}`);
}
function printCandidate(index, name, description, runtime, badges) {
    const badgeText = badges.length > 0 ? ` ${badges.join(' ')}` : '';
    console.log(`${chalk.dim(`${index}.`.padEnd(4))}${chalk.greenBright(name)}${badgeText}`);
    console.log(chalk.gray(`    ${truncate(description || 'No description', 110)}`));
    console.log(chalk.dim(`    ${runtime}`));
}
function printEmpty(message) {
    console.log(chalk.yellow(message));
}
function truncate(value, maxLength) {
    if (value.length <= maxLength) {
        return value;
    }
    return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}
