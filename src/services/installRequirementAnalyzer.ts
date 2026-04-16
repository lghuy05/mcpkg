import { fetchWithTimeout } from './http.js';
import {
  InstallRequirement,
  McpPackage,
  McpRepository,
  McpServer,
} from '../types/mcp.js';

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

interface AgentRequirementPayload {
  requirements?: Array<{
    kind?: string;
    key?: string;
    label?: string;
    prompt?: string;
    required?: boolean;
    secret?: boolean;
    defaultValue?: string;
    argType?: string;
    flag?: string;
    confidence?: string;
    evidence?: string;
  }>;
}

const MAX_DOC_CHARS = 12000;

export async function analyzeInstallRequirements(
  server: McpServer
): Promise<InstallRequirement[]> {
  // Registry metadata is treated as authoritative, then README analysis fills
  // gaps for the many packages that document setup only in prose.
  const requirements = [
    ...registryRequirements(server),
    ...await readmeRequirements(server),
  ];

  return dedupeRequirements(requirements);
}

function registryRequirements(server: McpServer): InstallRequirement[] {
  const requirements: InstallRequirement[] = [];
  const pkg = server.packages?.length ? selectBestPackage(server.packages) : undefined;
  const remote = server.remotes?.[0];

  pkg?.environmentVariables?.forEach((envVar) => {
    if (!envVar.isRequired) {
      return;
    }

    requirements.push({
      kind: 'env',
      key: `env:${envVar.name}`,
      label: envVar.name,
      prompt: envVar.description || `Enter ${envVar.name}`,
      source: 'registry',
      confidence: 'high',
      required: true,
      secret: envVar.isSecret,
      evidence: 'Registry package environmentVariables',
    });
  });

  pkg?.packageArguments?.forEach((arg, index) => {
    if (!arg.isRequired) {
      return;
    }

    const isNamed = arg.type === 'named';
    requirements.push({
      kind: 'arg',
      key: `arg:${arg.name}`,
      label: arg.name,
      prompt: arg.description || `Enter ${arg.name}`,
      source: 'registry',
      confidence: 'high',
      required: true,
      secret: arg.isSecret,
      defaultValue: arg.default,
      argType: isNamed ? 'named' : 'positional',
      flag: isNamed ? `--${arg.name}` : undefined,
      order: index,
      evidence: 'Registry package packageArguments',
    });
  });

  if (remote?.variables) {
    Object.entries(remote.variables).forEach(([name, variable]) => {
      if (!variable.isRequired) {
        return;
      }

      requirements.push({
        kind: 'variable',
        key: `variable:${name}`,
        label: name,
        prompt: variable.description || `Enter ${name}`,
        source: 'registry',
        confidence: 'high',
        required: true,
        secret: variable.isSecret,
        defaultValue: variable.default,
        evidence: 'Registry remote variables',
      });
    });
  }

  remote?.headers?.forEach((header) => {
    if (!header.isRequired) {
      return;
    }

    requirements.push({
      kind: 'header',
      key: `header:${header.name}`,
      label: header.name,
      prompt: header.description || `Enter ${header.name}`,
      source: 'registry',
      confidence: 'high',
      required: true,
      secret: header.isSecret,
      defaultValue: header.default,
      evidence: 'Registry remote headers',
    });
  });

  return requirements;
}

async function readmeRequirements(server: McpServer): Promise<InstallRequirement[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Keep the CLI useful without an API key. This only detects obvious env
    // var names, so callers should treat these as medium-confidence hints.
    return heuristicReadmeRequirements(await loadDocs(server));
  }

  const docs = await loadDocs(server);
  if (!docs.trim()) {
    return [];
  }

  try {
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
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
              parts: [{ text: buildRequirementPrompt(server, docs) }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      return heuristicReadmeRequirements(docs);
    }

    const data = (await response.json()) as GeminiGenerateContentResponse;
    const parsed = parseJsonResponse(extractText(data)) as AgentRequirementPayload;
    return normalizeAgentRequirements(parsed.requirements ?? []);
  } catch {
    return heuristicReadmeRequirements(docs);
  }
}

async function loadDocs(server: McpServer): Promise<string> {
  const docs: string[] = [];

  // Use both repository README and package README because registry entries are
  // inconsistent about which one contains the real install instructions.
  const repoReadme = await fetchRepositoryReadme(server.repository);
  if (repoReadme) {
    docs.push(repoReadme);
  }

  const pkg = server.packages?.length ? selectBestPackage(server.packages) : undefined;
  const npmReadme = pkg ? await fetchNpmReadme(pkg) : null;
  if (npmReadme) {
    docs.push(npmReadme);
  }

  return docs.join('\n\n').slice(0, MAX_DOC_CHARS);
}

async function fetchRepositoryReadme(repository?: McpRepository): Promise<string | null> {
  const url = repository?.url;
  if (!url) {
    return null;
  }

  const match = url.match(/github\.com[:/](?<owner>[^/]+)\/(?<repo>[^/#.]+)(?:\.git)?/i);
  if (!match?.groups) {
    return null;
  }

  const owner = match.groups.owner;
  const repo = match.groups.repo;
  const candidates = [
    `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/README.md`,
    `https://raw.githubusercontent.com/${owner}/${repo}/main/README.md`,
    `https://raw.githubusercontent.com/${owner}/${repo}/master/README.md`,
  ];

  for (const candidate of candidates) {
    try {
      const response = await fetchWithTimeout(candidate);
      if (response.ok) {
        return await response.text();
      }
    } catch {
      // Try the next common README location.
    }
  }

  return null;
}

async function fetchNpmReadme(pkg: McpPackage): Promise<string | null> {
  try {
    const response = await fetchWithTimeout(
      `https://registry.npmjs.org/${encodeURIComponent(pkg.identifier)}`
    );
    if (!response.ok) {
      return null;
    }

    const data = await response.json() as { readme?: string };
    return typeof data.readme === 'string' ? data.readme : null;
  } catch {
    return null;
  }
}

function heuristicReadmeRequirements(docs: string): InstallRequirement[] {
  const requirements: InstallRequirement[] = [];
  const envPattern = /\b[A-Z][A-Z0-9_]{2,}\b/g;
  const envNames = new Set<string>();

  for (const match of docs.matchAll(envPattern)) {
    const name = match[0];
    if (!/(KEY|TOKEN|SECRET|URL|URI|HOST|PASSWORD|USERNAME|USER|ID)$/.test(name)) {
      continue;
    }
    envNames.add(name);
  }

  Array.from(envNames).slice(0, 8).forEach((name) => {
    requirements.push({
      kind: 'env',
      key: `env:${name}`,
      label: name,
      prompt: `Enter ${name}`,
      source: 'readme',
      confidence: 'medium',
      required: true,
      secret: /(KEY|TOKEN|SECRET|PASSWORD)$/.test(name),
      evidence: 'README mentions this environment variable',
    });
  });

  return requirements;
}

function buildRequirementPrompt(server: McpServer, docs: string): string {
  return [
    'Extract MCP install requirements from the server metadata and documentation.',
    'Return JSON only.',
    'Only include inputs needed before the MCP client can start the server.',
    'Do not include ordinary MCP tool-call arguments.',
    'Prefer env vars for API keys, tokens, database URLs, and connection strings.',
    'Use args only for launch-time command-line arguments.',
    'Use confidence high only when docs clearly state the requirement.',
    'Return this shape:',
    '{"requirements":[{"kind":"env|arg|header|variable","key":"GITHUB_TOKEN","label":"GITHUB_TOKEN","prompt":"Enter GITHUB_TOKEN","required":true,"secret":true,"argType":"named|positional","flag":"--flag","confidence":"high|medium|low","evidence":"short quote or reason"}]}',
    `Server metadata: ${JSON.stringify(server)}`,
    `Documentation: ${docs}`,
  ].join('\n');
}

function normalizeAgentRequirements(
  rawRequirements: NonNullable<AgentRequirementPayload['requirements']>
): InstallRequirement[] {
  return rawRequirements.flatMap((raw, index) => {
    if (!isRequirementKind(raw.kind) || !raw.key || !raw.prompt) {
      return [];
    }

    const cleanKey = raw.key.replace(/^(env|arg|header|variable):/, '');
    const key = `${raw.kind}:${cleanKey}`;

    return [{
      kind: raw.kind,
      key,
      label: raw.label?.trim() || cleanKey,
      prompt: raw.prompt.trim(),
      source: 'readme',
      confidence: isConfidence(raw.confidence) ? raw.confidence : 'medium',
      required: raw.required !== false,
      secret: raw.secret,
      defaultValue: raw.defaultValue,
      argType: raw.argType === 'named' ? 'named' : raw.kind === 'arg' ? 'positional' : undefined,
      flag: raw.flag,
      order: index,
      evidence: raw.evidence,
    }];
  });
}

function dedupeRequirements(requirements: InstallRequirement[]): InstallRequirement[] {
  const seen = new Set<string>();
  return requirements.filter((requirement) => {
    const key = `${requirement.kind}:${requirement.key.toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function selectBestPackage(packages: McpPackage[]): McpPackage {
  return [...packages].sort((a, b) => scorePackage(b) - scorePackage(a))[0];
}

function scorePackage(pkg: McpPackage): number {
  let score = 0;

  if (pkg.transport?.type === 'stdio') score += 100;
  if (pkg.registryType === 'npm') score += 30;
  if (pkg.registryType === 'docker') score += 20;
  if (pkg.registryType === 'pypi') score += 10;
  if (pkg.environmentVariables?.length) score += 5;
  if (pkg.packageArguments?.length) score += 5;

  return score;
}

function isRequirementKind(value: unknown): value is InstallRequirement['kind'] {
  return value === 'env' || value === 'arg' || value === 'header' || value === 'variable';
}

function isConfidence(value: unknown): value is InstallRequirement['confidence'] {
  return value === 'high' || value === 'medium' || value === 'low';
}

function extractText(data: GeminiGenerateContentResponse): string {
  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('')
    .trim();

  if (!text) {
    throw new Error('Gemini response did not include any text content.');
  }

  return text;
}

function parseJsonResponse(text: string): unknown {
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

    throw new Error('Failed to parse requirement JSON response');
  }
}
