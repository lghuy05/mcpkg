import { sortServersByScore, scoreServer } from './ranking.js';
import { promptUserSelection } from './prompts.js';
export async function pickBestServer(entries, query) {
    if (entries.length === 0)
        return null;
    const exact = findExactEntry(entries, query);
    if (exact) {
        return exact;
    }
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
export function findExactEntry(entries, query) {
    const normalized = query.trim().toLowerCase();
    return (entries.find((entry) => {
        const name = entry.server.name?.trim().toLowerCase();
        const id = entry.server.id?.trim().toLowerCase();
        return name === normalized || id === normalized;
    }) ?? null);
}
export function hasClearlyDominantMatch(entries, query) {
    if (entries.length <= 1) {
        return true;
    }
    const sorted = sortServersByScore(entries, query);
    const bestScore = scoreServer(sorted[0], query);
    const secondScore = scoreServer(sorted[1], query);
    return bestScore - secondScore >= 20;
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
