import { RegistryServerEntry } from '../types/mcp.js';
import { fetchWithTimeout } from './http.js';
import { searchRegistry } from './registry.js';
import { recommendServer } from './recommend.js';

export interface AgentFindResult {
  entry: RegistryServerEntry | null;
  rationale: string[];
  source: 'agent' | 'heuristic';
  searchedTerms?: string[];
  decision?: string;
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

interface IntentDecisionResult {
  primaryQuery: string;
  fallbackQueries?: string[];
  reason?: string;
}

export async function findServerWithAgent(query: string): Promise<AgentFindResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  debug(`starting find for query: ${query}`);

  if (!apiKey) {
    return findHeuristically(query);
  }

  const decision = await decidePrimaryQuery(query, apiKey);
  const searchedTerms = expandSearchTerms(query, [
    decision.primaryQuery,
    ...(decision.fallbackQueries ?? []),
  ]).slice(0, 4);

  debug(`decision primary query: ${decision.primaryQuery}`);
  debug(`decision fallback queries: ${(decision.fallbackQueries ?? []).join(' | ')}`);

  const gatheredCandidates = await gatherCandidates(searchedTerms);
  // Natural-language requests often include runtime constraints such as
  // "npx" or "stdio"; enforce those against registry metadata before ranking.
  const candidates = filterCandidatesByExplicitRuntime(query, gatheredCandidates);
  debug(`candidate count after registry search: ${gatheredCandidates.length}`);
  debug(`candidate count after runtime filter: ${candidates.length}`);

  if (candidates.length === 0) {
    return {
      entry: null,
      rationale: [
        'The agent picked a likely MCP category, but the registry returned no candidates.',
        ...(decision.reason ? [decision.reason] : []),
      ],
      source: 'agent',
      searchedTerms,
      decision: decision.primaryQuery,
    };
  }

  const fallback = recommendServer(candidates, query);
  if (!fallback) {
    return {
      entry: null,
      rationale: ['Candidates were fetched, but no recommendation could be produced.'],
      source: 'agent',
      searchedTerms,
      decision: decision.primaryQuery,
    };
  }

  try {
    const choice = await chooseBestCandidate(query, candidates, apiKey);
    const selected =
      candidates.find((entry) => entry.server.id === choice.serverId) ??
      candidates.find((entry) => entry.server.name === choice.serverName) ??
      fallback.entry;

    return {
      entry: selected,
      rationale: choice.rationale.length > 0 ? choice.rationale : fallback.rationale,
      source: 'agent',
      searchedTerms,
      decision: decision.primaryQuery,
    };
  } catch (error) {
    return {
      entry: fallback.entry,
      rationale: [
        formatRankingFailureReason(error),
        ...(decision.reason ? [decision.reason] : []),
        ...fallback.rationale,
      ],
      source: 'heuristic',
      searchedTerms,
      decision: decision.primaryQuery,
    };
  }
}

async function findHeuristically(query: string): Promise<AgentFindResult | null> {
  const searchedTerms = heuristicDecision(query);
  const candidates = filterCandidatesByExplicitRuntime(query, await gatherCandidates(searchedTerms));
  const fallback = recommendServer(candidates, query);

  if (!fallback) {
    return {
      entry: null,
      rationale: ['No registry candidates were found for the heuristic search terms.'],
      source: 'heuristic',
      searchedTerms,
      decision: searchedTerms[0],
    };
  }

  return {
    entry: fallback.entry,
    rationale: [
      'GEMINI_API_KEY not configured, so mcpkg used heuristic intent selection and local ranking.',
      ...fallback.rationale,
    ],
    source: 'heuristic',
    searchedTerms,
    decision: searchedTerms[0],
  };
}

async function decidePrimaryQuery(
  query: string,
  apiKey: string
): Promise<IntentDecisionResult> {
  try {
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
    const prompt = [
      'Decide the single best MCP registry search term for the user request.',
      'Think in capability or integration categories like filesystem, gmail, github, slack, postgres, browser.',
      'Return JSON only with this shape:',
      '{"primaryQuery":"string","fallbackQueries":["string"],"reason":"short sentence"}',
      'Rules:',
      '- primaryQuery should usually be 1 to 3 words.',
      '- fallbackQueries should be short and optional.',
      '- Do not include markdown.',
      `User request: ${query}`,
    ].join('\n');

    debug(`calling gemini decision model: ${model}`);
    const response = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      const raw = await response.text();
      throw new Error(`Gemini API returned ${response.status}: ${raw.slice(0, 300)}`);
    }

    const data = (await response.json()) as GeminiGenerateContentResponse;
    const text = extractText(data);
    const parsed = parseJsonResponse(text) as IntentDecisionResult;

    if (process.env.MCPKG_DEBUG === '1') {
      console.error(`[mcpkg:debug] decision response: ${text}`);
    }

    const primaryQuery =
      typeof parsed.primaryQuery === 'string' && parsed.primaryQuery.trim()
        ? parsed.primaryQuery.trim()
        : heuristicDecision(query)[0];

    const fallbackQueries = Array.isArray(parsed.fallbackQueries)
      ? parsed.fallbackQueries.filter((value: unknown): value is string => typeof value === 'string')
      : [];

    return {
      primaryQuery,
      fallbackQueries,
      reason: typeof parsed.reason === 'string' ? parsed.reason : undefined,
    };
  } catch (error) {
    debug(`decision step failed: ${String(error)}`);
    const terms = heuristicDecision(query);
    return {
      primaryQuery: terms[0],
      fallbackQueries: terms.slice(1),
      reason: 'Heuristic intent selection was used because the Gemini decision step failed.',
    };
  }
}

async function gatherCandidates(queries: string[]): Promise<RegistryServerEntry[]> {
  const seen = new Set<string>();
  const combined: RegistryServerEntry[] = [];

  // Search all fallback terms before ranking. Early stopping made the agent
  // miss good packages when the first generated registry term was too narrow.
  for (const query of dedupeTerms(queries).slice(0, 5)) {
    debug(`searching registry with query: ${query}`);

    try {
      const entries = await searchRegistry(query);

      for (const entry of entries) {
        const key = entry.server.id || entry.server.name;
        if (!key || seen.has(key)) {
          continue;
        }

        seen.add(key);
        combined.push(entry);

        if (combined.length >= 16) {
          return combined;
        }
      }
    } catch (error) {
      debug(`registry search failed for "${query}": ${String(error)}`);
    }
  }

  return combined;
}

async function chooseBestCandidate(
  query: string,
  entries: RegistryServerEntry[],
  apiKey: string
): Promise<{ serverId?: string; serverName?: string; rationale: string[] }> {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
  const prompt = buildChoicePrompt(query, entries);

  debug(`calling gemini ranking model: ${model}`);
  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`Gemini API returned ${response.status}: ${raw.slice(0, 300)}`);
  }

  const data = (await response.json()) as GeminiGenerateContentResponse;
  const text = extractText(data);
  const parsed = parseJsonResponse(text);

  if (process.env.MCPKG_DEBUG === '1') {
    console.error(`[mcpkg:debug] ranking response: ${text}`);
  }

  return {
    serverId: typeof parsed.serverId === 'string' ? parsed.serverId : undefined,
    serverName: typeof parsed.serverName === 'string' ? parsed.serverName : undefined,
    rationale: Array.isArray(parsed.rationale)
      ? parsed.rationale.filter((value: unknown): value is string => typeof value === 'string')
      : [],
  };
}

function buildChoicePrompt(query: string, entries: RegistryServerEntry[]): string {
  const candidates = entries.slice(0, 8).map((entry) => ({
    id: entry.server.id,
    name: entry.server.name,
    description: entry.server.description,
    packages: entry.server.packages?.map((pkg) => ({
      registryType: pkg.registryType,
      identifier: pkg.identifier,
      transport: pkg.transport?.type,
      envVars: pkg.environmentVariables?.map((envVar) => envVar.name) ?? [],
    })) ?? [],
    remotes: entry.server.remotes ?? [],
    repository: entry.server.repository?.url,
  }));

  return [
    'Pick the single best MCP server from the provided candidates for the user request.',
    'Choose only from the candidates.',
    'Keep the rationale short and practical.',
    'Do not claim a server supports npm, npx, or stdio unless package metadata explicitly shows it.',
    'If the user asks for npx, npm, local, or stdio, prefer package-based stdio candidates over remote endpoints.',
    'Return JSON only with this shape:',
    '{"serverId":"string or empty","serverName":"string","rationale":["reason 1","reason 2"]}',
    `User request: ${query}`,
    `Candidates: ${JSON.stringify(candidates)}`,
  ].join('\n');
}

function filterCandidatesByExplicitRuntime(
  query: string,
  entries: RegistryServerEntry[]
): RegistryServerEntry[] {
  const normalized = query.toLowerCase();
  const wantsStdio = /\b(stdio|local|desktop|npx|npm)\b/.test(normalized);
  const wantsNpm = /\b(npx|npm)\b/.test(normalized);

  if (!wantsStdio && !wantsNpm) {
    return entries;
  }

  const filtered = entries.filter((entry) => {
    const packages = entry.server.packages ?? [];
    return packages.some((pkg) => {
      const matchesTransport = !wantsStdio || pkg.transport?.type === 'stdio';
      const matchesRegistry = !wantsNpm || pkg.registryType === 'npm';
      return matchesTransport && matchesRegistry;
    });
  });

  return filtered.length > 0 ? filtered : entries;
}

function extractText(response: GeminiGenerateContentResponse): string {
  const parts: string[] = [];

  for (const candidate of response.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.text) {
        parts.push(part.text);
      }
    }
  }

  const text = parts.join('\n').trim();
  if (!text) {
    throw new Error('Gemini response did not include text output');
  }

  return text;
}

function parseJsonResponse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1]);
    }

    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1));
    }

    throw new Error('Failed to parse Gemini JSON response');
  }
}

function heuristicDecision(query: string): string[] {
  const normalized = query.toLowerCase();

  if (normalized.includes('gmail')) {
    return ['gmail', 'gmail email', 'google mail'];
  }

  if (normalized.includes('google map') || normalized.includes('maps')) {
    return ['google maps', 'maps'];
  }

  if (normalized.includes('file') || normalized.includes('folder') || normalized.includes('desktop')) {
    return ['filesystem', 'local files', 'file system'];
  }

  if (/\b(postgres|postgresql|database|sql)\b/.test(normalized)) {
    return ['postgres', 'postgresql database'];
  }

  if (normalized.includes('github')) {
    return ['github'];
  }

  if (normalized.includes('slack')) {
    return ['slack'];
  }

  return [query];
}

function expandSearchTerms(userQuery: string, terms: string[]): string[] {
  const expanded = [...terms];
  const normalized = userQuery.toLowerCase();

  if (/\b(postgres|postgresql|database|sql)\b/.test(normalized)) {
    expanded.push('postgres', 'postgresql database');
  }

  if (/\b(npx|npm|stdio|local)\b/.test(normalized) && /\b(postgres|postgresql)\b/.test(normalized)) {
    expanded.push('postgres');
  }

  return dedupeTerms(expanded);
}

function dedupeTerms(terms: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const term of terms) {
    const trimmed = term.trim();
    if (!trimmed) {
      continue;
    }

    const normalized = trimmed.toLowerCase();
    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    deduped.push(trimmed);
  }

  return deduped;
}

function formatRankingFailureReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `The Gemini candidate-selection step failed, so mcpkg fell back to local ranking. Error: ${message}`;
}

function debug(message: string): void {
  if (process.env.MCPKG_DEBUG === '1') {
    console.error(`[mcpkg:debug] ${message}`);
  }
}
