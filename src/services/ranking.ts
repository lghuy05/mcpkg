
import { RegistryServerEntry } from '../types/mcp.js';

const OFFICIAL_META_KEY = 'io.modelcontextprotocol.registry/official';

export function getOfficialMeta(entry: RegistryServerEntry) {
  return entry._meta?.[OFFICIAL_META_KEY] as
    | { status?: string; isLatest?: boolean }
    | undefined;
}

export function isOfficial(entry: RegistryServerEntry): boolean {
  return Boolean(getOfficialMeta(entry));
}

export function isActive(entry: RegistryServerEntry): boolean {
  return getOfficialMeta(entry)?.status === 'active';
}

export function isLatest(entry: RegistryServerEntry): boolean {
  return getOfficialMeta(entry)?.isLatest === true;
}

export function hasRemote(entry: RegistryServerEntry): boolean {
  return Boolean(entry.server.remotes && entry.server.remotes.length > 0);
}

export function hasPackage(entry: RegistryServerEntry): boolean {
  return Boolean(entry.server.packages && entry.server.packages.length > 0);
}

export function hasDescription(entry: RegistryServerEntry): boolean {
  return Boolean(entry.server.description && entry.server.description.trim().length > 0);
}

export function scoreServer(entry: RegistryServerEntry, query: string): number {
  const normalizedQuery = query.trim().toLowerCase();
  const name = entry.server.name?.toLowerCase() ?? '';
  const id = entry.server.id?.toLowerCase() ?? '';
  const description = entry.server.description?.toLowerCase() ?? '';

  let score = 0;

  // Exact / near-exact match matters a lot
  if (name === normalizedQuery || id === normalizedQuery) {
    score += 100;
  } else if (name.includes(normalizedQuery) || id.includes(normalizedQuery)) {
    score += 35;
  } else if (description.includes(normalizedQuery)) {
    score += 10;
  }

  // Registry trust / freshness
  if (isOfficial(entry)) score += 50;
  if (isActive(entry)) score += 30;
  if (isLatest(entry)) score += 20;

  // Usability
  if (hasRemote(entry)) score += 12;
  if (hasPackage(entry)) score += 10;
  if (hasDescription(entry)) score += 5;

  return score;
}

export function sortServersByScore(
  entries: RegistryServerEntry[],
  query: string
): RegistryServerEntry[] {
  return [...entries].sort((a, b) => scoreServer(b, query) - scoreServer(a, query));
}
