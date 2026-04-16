import { hasDescription, hasPackage, hasRemote, isActive, isLatest, isOfficial, sortServersByScore, } from './ranking.js';
export function recommendServer(entries, query) {
    const sorted = sortServersByScore(entries, query);
    const entry = sorted[0];
    if (!entry) {
        return null;
    }
    const rationale = [];
    const description = entry.server.description?.toLowerCase() ?? '';
    const queryTerms = tokenize(query);
    const matchedTerms = queryTerms.filter((term) => description.includes(term));
    if (matchedTerms.length > 0) {
        rationale.push(`Description matches your request: ${matchedTerms.join(', ')}`);
    }
    if (isOfficial(entry)) {
        rationale.push('Official registry entry');
    }
    if (isActive(entry)) {
        rationale.push('Marked active in the registry');
    }
    if (isLatest(entry)) {
        rationale.push('Latest official version');
    }
    if (hasRemote(entry)) {
        rationale.push('Ready as a remote MCP endpoint');
    }
    else if (hasPackage(entry)) {
        rationale.push('Installable local package is available');
    }
    if (hasDescription(entry) && rationale.length === 0) {
        rationale.push('Has enough metadata to make it the strongest current match');
    }
    if (rationale.length === 0) {
        rationale.push('Best match from the registry ranking heuristics');
    }
    return { entry, rationale };
}
function tokenize(text) {
    return text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((term) => term.trim())
        .filter((term) => term.length >= 3);
}
