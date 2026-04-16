import { fetchWithTimeout } from './http.js';
import { ClientMcpConfig, InstallQuestion, McpServer, VerificationResult } from '../types/mcp.js';

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

export type RetryDecision =
  | {
      kind: 'ask_user';
      reason: string;
      question: InstallQuestion;
    }
  | {
      kind: 'fail';
      reason: string;
    };

interface RetryDecisionPayload {
  action?: 'ask_user' | 'fail';
  reason?: string;
  question?: {
    key?: string;
    label?: string;
    message?: string;
    required?: boolean;
    secret?: boolean;
    defaultValue?: string;
  };
}

export async function suggestInstallRetry(
  server: McpServer,
  config: ClientMcpConfig,
  verification: VerificationResult
): Promise<RetryDecision> {
  const deterministicFailure = getDeterministicFailureDecision(verification);
  if (deterministicFailure) {
    return deterministicFailure;
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      kind: 'fail',
      reason: 'GEMINI_API_KEY is not configured, so no agent retry could be attempted.',
    };
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
              parts: [{ text: buildRetryPrompt(server, config, verification) }],
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
    const parsed = parseJsonResponse(extractText(data)) as RetryDecisionPayload;

    if (parsed.action !== 'ask_user') {
      return {
        kind: 'fail',
        reason: parsed.reason?.trim() || 'The agent could not identify a safe single retry question.',
      };
    }

    const question = toInstallQuestion(parsed.question);
    if (!question) {
      return {
        kind: 'fail',
        reason: parsed.reason?.trim() || 'The agent response did not include a valid retry question.',
      };
    }

    return {
      kind: 'ask_user',
      reason: parsed.reason?.trim() || 'The agent identified one missing input worth retrying once.',
      question,
    };
  } catch (error) {
    return {
      kind: 'fail',
      reason:
        error instanceof Error
          ? `Agent retry failed: ${error.message}`
          : 'Agent retry failed with an unknown error.',
    };
  }
}

function getDeterministicFailureDecision(
  verification: VerificationResult
): RetryDecision | null {
  if (verification.failureKind === 'invalid_stdio_output') {
    return {
      kind: 'fail',
      reason: 'This server wrote non-JSON text to stdout before MCP initialization, so it is not safe for stdio MCP clients.',
    };
  }

  if (verification.failureKind === 'timeout') {
    return {
      kind: 'fail',
      reason: 'This server did not complete MCP initialization before the verifier timed out.',
    };
  }

  if (verification.failureKind === 'process_not_found') {
    return {
      kind: 'fail',
      reason: 'The configured command could not be started on this machine.',
    };
  }

  if (verification.failureKind === 'invalid_launcher') {
    return {
      kind: 'fail',
      reason: 'The package launcher failed before MCP startup, likely because the published npm bin cannot be executed directly.',
    };
  }

  const evidence = [
    verification.message,
    verification.stderr,
    verification.stdout,
    ...(verification.details ?? []),
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();

  if (evidence.includes('too many arguments') || evidence.includes('expected 0 arguments')) {
    return {
      kind: 'fail',
      reason: 'This server rejected extra command-line arguments, so mcpkg will not retry by asking for more args.',
    };
  }

  return null;
}

function buildRetryPrompt(
  server: McpServer,
  config: ClientMcpConfig,
  verification: VerificationResult
): string {
  return [
    'You are helping a CLI install an MCP server.',
    'The installer already built a config from metadata and verified it once.',
    'You may suggest at most one additional user prompt, or fail.',
    'Rules:',
    '- Return JSON only.',
    '- Only use one of these key prefixes: env:, arg:, header:, variable:.',
    '- Ask for only one missing input.',
    '- Prefer metadata-backed fields when possible.',
    '- Do not invent multiple flags, commands, or a new install plan.',
    '- If the evidence is weak or ambiguous, return fail.',
    'Return this JSON shape exactly:',
    '{"action":"ask_user|fail","reason":"short sentence","question":{"key":"env:OPENAI_API_KEY","label":"OPENAI_API_KEY","message":"Enter OPENAI_API_KEY","required":true,"secret":true,"defaultValue":""}}',
    `Server: ${JSON.stringify(server)}`,
    `Current config: ${JSON.stringify(config)}`,
    `Verification: ${JSON.stringify({
      ok: verification.ok,
      message: verification.message,
      exitCode: verification.exitCode,
      details: verification.details ?? [],
      stdout: verification.stdout ?? '',
      stderr: verification.stderr ?? '',
    })}`,
  ].join('\n');
}

function toInstallQuestion(question: RetryDecisionPayload['question']): InstallQuestion | null {
  if (!question?.key || !question?.message) {
    return null;
  }

  if (!/^(env|arg|header|variable):/.test(question.key)) {
    return null;
  }

  return {
    key: question.key,
    label: question.label?.trim() || question.key.replace(/^[^:]+:/, ''),
    message: question.message.trim(),
    required: question.required !== false,
    secret: question.secret,
    defaultValue: question.defaultValue,
  };
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
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}
