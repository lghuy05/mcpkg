import inquirer from 'inquirer';
import { sortServersByScore, scoreServer } from './ranking.js';
export async function pickBestServer(entries, query) {
    if (entries.length === 0)
        return null;
    const sorted = sortServersByScore(entries, query);
    // If only one → trivial
    if (sorted.length === 1)
        return sorted[0];
    const best = sorted[0];
    const second = sorted[1];
    const bestScore = scoreServer(best, query);
    const secondScore = scoreServer(second, query);
    // 🧠 Heuristic: if clearly better → auto pick
    if (bestScore - secondScore >= 20) {
        return best;
    }
    // Otherwise → ask user
    return await promptUserSelection(sorted);
}
function getKind(entry) {
    if (entry?.server?.remotes?.length) {
        return 'remote';
    }
    else if (entry.server?.packages?.length) {
        return 'local';
    }
    else {
        return 'unknown';
    }
}
export async function promptUserSelection(entries) {
    const choices = entries.slice(0, 5).map((entry) => {
        const server = entry.server;
        return {
            name: `${server.name} (${getKind(entry)})\n ${server.description ?? 'No description'}`,
            value: entry,
        };
    });
    const answer = await inquirer.prompt([
        {
            type: 'select',
            name: 'selected',
            message: 'Multiple MCP servers found. Choose one:',
            choices,
        },
    ]);
    return answer.selected;
}
