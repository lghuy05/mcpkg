import { sortServersByScore, scoreServer } from './ranking.js';
import { promptUserSelection } from './prompts.js';
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
export function getKind(entry) {
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
