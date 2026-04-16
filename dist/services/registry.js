import { fetchWithTimeout } from './http.js';
const REGISTRY_URL = 'https://registry.modelcontextprotocol.io/v0/servers';
export async function searchRegistry(query) {
    const response = await fetchWithTimeout(`${REGISTRY_URL}?search=${encodeURIComponent(query)}`);
    if (!response.ok) {
        throw new Error(`Registry API returned ${response.status}`);
    }
    const data = (await response.json());
    return data.servers ?? [];
}
export async function findExactServer(query) {
    const entries = await searchRegistry(query);
    const normalized = query.trim().toLowerCase();
    const exactEntry = entries.find((entry) => entry.server.name?.toLowerCase() === normalized);
    return exactEntry?.server ?? null;
}
