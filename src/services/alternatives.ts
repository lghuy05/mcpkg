import { RegistryServerEntry, McpServer } from '../types/mcp.js';
import { recommendServer } from './recommend.js';
import { searchRegistry } from './registry.js';
import { sortServersByScore } from './ranking.js';

export interface AlternativeRecommendation {
  entry: RegistryServerEntry;
  rationale: string[];
}

export async function suggestAlternativeServers(
  failedServer: McpServer,
  originalQuery: string,
  maxResults = 3
): Promise<AlternativeRecommendation[]> {
  const candidates = await gatherAlternativeCandidates(failedServer, originalQuery);
  const failedKeys = new Set(
    [failedServer.id, failedServer.name]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase())
  );
  const relevanceTerms = inferRelevanceTerms(failedServer, originalQuery);

  const alternatives = candidates.filter((entry) => {
    const keys = [entry.server.id, entry.server.name]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase());

    if (keys.some((key) => failedKeys.has(key))) {
      return false;
    }

    return relevanceTerms.length === 0 || entryMatchesAnyTerm(entry, relevanceTerms);
  });

  return sortServersByScore(alternatives, originalQuery)
    .slice(0, maxResults)
    .map((entry) => ({
      entry,
      rationale: recommendServer([entry], originalQuery)?.rationale ?? ['Best remaining registry match'],
    }));
}

function inferRelevanceTerms(failedServer: McpServer, originalQuery: string): string[] {
  const text = serverText(failedServer, originalQuery);

  if (/\b(postgres|postgresql|database|sql)\b/.test(text)) {
    return ['postgres', 'postgresql', 'database', 'sql'];
  }

  if (/\b(github|git)\b/.test(text)) {
    return ['github', 'git'];
  }

  if (/\b(slack)\b/.test(text)) {
    return ['slack'];
  }

  if (/\b(discord)\b/.test(text)) {
    return ['discord'];
  }

  if (/\b(log|logging|logs)\b/.test(text)) {
    return ['log', 'logging', 'logs'];
  }

  if (/\b(monitor|monitoring|metrics|observability)\b/.test(text)) {
    return ['monitor', 'monitoring', 'metrics', 'observability'];
  }

  return [];
}

function entryMatchesAnyTerm(entry: RegistryServerEntry, terms: string[]): boolean {
  const text = serverText(entry.server, '').toLowerCase();
  return terms.some((term) => text.includes(term));
}

async function gatherAlternativeCandidates(
  failedServer: McpServer,
  originalQuery: string
): Promise<RegistryServerEntry[]> {
  const seen = new Set<string>();
  const combined: RegistryServerEntry[] = [];

  for (const query of buildAlternativeQueries(failedServer, originalQuery)) {
    try {
      const entries = await searchRegistry(query);
      for (const entry of entries) {
        const key = entry.server.id || entry.server.name;
        if (!key || seen.has(key)) {
          continue;
        }

        seen.add(key);
        combined.push(entry);
      }
    } catch {
      // A failed fallback search should not hide the original install failure.
    }
  }

  return combined;
}

function buildAlternativeQueries(failedServer: McpServer, originalQuery: string): string[] {
  const text = serverText(failedServer, originalQuery);

  const queries: string[] = [];

  if (/\b(postgres|postgresql|database|sql)\b/.test(text)) {
    queries.push('postgres', 'postgresql database');
  }

  if (/\b(github|git)\b/.test(text)) {
    queries.push('github');
  }

  if (/\b(slack)\b/.test(text)) {
    queries.push('slack');
  }

  if (/\b(discord)\b/.test(text)) {
    queries.push('discord');
  }

  if (/\b(log|logging|logs)\b/.test(text)) {
    queries.push('logging', 'logs');
  }

  if (/\b(monitor|monitoring|metrics|observability)\b/.test(text)) {
    queries.push('monitoring', 'metrics');
  }

  queries.push(originalQuery, failedServer.name);

  return dedupe(queries).slice(0, 5);
}

function serverText(server: McpServer, extra: string): string {
  return [
    extra,
    server.name,
    server.id,
    server.description,
    server.packages?.map((pkg) => pkg.identifier).join(' '),
    server.repository?.url,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    const normalized = trimmed.toLowerCase();
    if (!trimmed || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    deduped.push(trimmed);
  }

  return deduped;
}
