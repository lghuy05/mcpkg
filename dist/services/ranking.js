const OFFICIAL_META_KEY = 'io.modelcontextprotocol.registry/official';
export function getOfficialMeta(entry) {
    return entry._meta?.[OFFICIAL_META_KEY];
}
export function isOfficial(entry) {
    return Boolean(getOfficialMeta(entry));
}
export function isActive(entry) {
    return getOfficialMeta(entry)?.status === 'active';
}
export function isLatest(entry) {
    return getOfficialMeta(entry)?.isLatest === true;
}
export function hasRemote(entry) {
    return Boolean(entry.server.remotes && entry.server.remotes.length > 0);
}
export function hasPackage(entry) {
    return Boolean(entry.server.packages && entry.server.packages.length > 0);
}
export function hasDescription(entry) {
    return Boolean(entry.server.description && entry.server.description.trim().length > 0);
}
export function scoreServer(entry, query) {
    const normalizedQuery = query.trim().toLowerCase();
    const name = entry.server.name?.toLowerCase() ?? '';
    const id = entry.server.id?.toLowerCase() ?? '';
    const description = entry.server.description?.toLowerCase() ?? '';
    let score = 0;
    // Exact / near-exact match matters a lot
    if (name === normalizedQuery || id === normalizedQuery) {
        score += 100;
    }
    else if (name.includes(normalizedQuery) || id.includes(normalizedQuery)) {
        score += 35;
    }
    else if (description.includes(normalizedQuery)) {
        score += 10;
    }
    // Registry trust / freshness
    if (isOfficial(entry))
        score += 50;
    if (isActive(entry))
        score += 30;
    if (isLatest(entry))
        score += 20;
    // Usability
    if (hasRemote(entry))
        score += 12;
    if (hasPackage(entry))
        score += 10;
    if (hasDescription(entry))
        score += 5;
    return score;
}
export function sortServersByScore(entries, query) {
    return [...entries].sort((a, b) => scoreServer(b, query) - scoreServer(a, query));
}
