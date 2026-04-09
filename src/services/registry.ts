import { McpServer, RegistrySearchResponse, RegistryServerEntry } from '../types/mcp.js';

const REGISTRY_URL = 'https://registry.modelcontextprotocol.io/v0/servers';

export async function searchRegistry(query: string): Promise<RegistryServerEntry[]> {
  const response = await fetch(
    `${REGISTRY_URL}?search=${encodeURIComponent(query)}`
  );

  if (!response.ok) {
    throw new Error(`Registry API returned ${response.status}`);
  }

  const data = (await response.json()) as RegistrySearchResponse;
  return data.servers ?? [];
}

export async function findExactServer(query: string): Promise<McpServer | null> {
  const entries = await searchRegistry(query);

  const normalized = query.trim().toLowerCase();

  const exactEntry =
    entries.find((entry) => entry.server.name?.toLowerCase() === normalized);

  return exactEntry?.server ?? null;
}
