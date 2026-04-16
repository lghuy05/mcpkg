import { spawn } from 'node:child_process';
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';
const DEFAULT_VERIFY_TIMEOUT_MS = 30000;
export async function verifyConfig(config) {
    if ('command' in config) {
        return verifyLocalConfig(config.command, config.args, config.env);
    }
    return verifyRemoteConfig(config.url, config.headers);
}
async function verifyLocalConfig(command, args, env) {
    return new Promise((resolve) => {
        const timeoutMs = getVerifyTimeoutMs();
        const child = spawn(command, args, {
            env: {
                ...process.env,
                ...env,
            },
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        let stdoutBuffer = '';
        let stderrBuffer = '';
        let initialized = false;
        let settled = false;
        const timer = setTimeout(() => {
            if (settled)
                return;
            settled = true;
            child.kill();
            resolve({
                ok: false,
                message: 'Timed out while waiting for MCP server initialization',
                details: compactDetails(stderrBuffer, stdoutBuffer),
                stdout: compactChunk(stdoutBuffer),
                stderr: compactChunk(stderrBuffer),
                failureKind: 'timeout',
            });
        }, timeoutMs);
        child.stdout.on('data', (chunk) => {
            stdoutBuffer += chunk.toString();
            const lines = stdoutBuffer.split('\n');
            stdoutBuffer = lines.pop() ?? '';
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed)
                    continue;
                try {
                    const message = JSON.parse(trimmed);
                    // A useful install is one that can complete the minimum MCP stdio
                    // handshake. We initialize first, then ask for tools/list.
                    if (message.id === 1 && message.result && !initialized) {
                        initialized = true;
                        child.stdin.write(JSON.stringify({
                            jsonrpc: '2.0',
                            method: 'notifications/initialized',
                        }) + '\n');
                        child.stdin.write(JSON.stringify({
                            jsonrpc: '2.0',
                            id: 2,
                            method: 'tools/list',
                        }) + '\n');
                    }
                    else if (message.id === 2 && message.result) {
                        if (settled)
                            return;
                        settled = true;
                        clearTimeout(timer);
                        child.kill();
                        resolve({
                            ok: true,
                            message: 'MCP stdio server responded to initialize and tools/list',
                            stdout: compactChunk(stdoutBuffer),
                            stderr: compactChunk(stderrBuffer),
                        });
                    }
                }
                catch {
                    if (!initialized && !settled) {
                        settled = true;
                        clearTimeout(timer);
                        child.kill();
                        resolve({
                            ok: false,
                            message: 'Server wrote non-JSON output to stdout before MCP initialization',
                            details: compactDetails(trimmed, stderrBuffer),
                            stdout: compactChunk(`${trimmed}\n${stdoutBuffer}`),
                            stderr: compactChunk(stderrBuffer),
                            failureKind: 'invalid_stdio_output',
                        });
                        return;
                    }
                }
            }
        });
        child.stderr.on('data', (chunk) => {
            stderrBuffer += chunk.toString();
        });
        child.on('error', (error) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            resolve({
                ok: false,
                message: `Failed to start process: ${error.message}`,
                details: compactDetails(stderrBuffer),
                stdout: compactChunk(stdoutBuffer),
                stderr: compactChunk(stderrBuffer),
                failureKind: 'process_not_found',
            });
        });
        child.on('exit', (code) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            resolve({
                ok: false,
                message: `Process exited before verification completed${code !== null ? ` (code ${code})` : ''}`,
                details: compactDetails(stderrBuffer, stdoutBuffer),
                exitCode: code,
                stdout: compactChunk(stdoutBuffer),
                stderr: compactChunk(stderrBuffer),
                failureKind: classifyProcessExit(stderrBuffer, stdoutBuffer),
            });
        });
        child.stdin.write(JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
                protocolVersion: LATEST_PROTOCOL_VERSION,
                capabilities: {},
                clientInfo: {
                    name: 'mcpkg-verifier',
                    version: '0.1.0',
                },
            },
        }) + '\n');
    });
}
async function verifyRemoteConfig(url, headers) {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), getVerifyTimeoutMs());
        const response = await fetch(url, {
            method: 'GET',
            headers,
            signal: controller.signal,
        });
        clearTimeout(timer);
        if (response.ok || response.status < 500) {
            return {
                ok: true,
                message: `Remote endpoint responded with HTTP ${response.status}`,
                exitCode: response.status,
            };
        }
        return {
            ok: false,
            message: `Remote endpoint returned HTTP ${response.status}`,
            exitCode: response.status,
            failureKind: response.status === 401 || response.status === 403 ? 'missing_input' : 'remote_unreachable',
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown remote verification error';
        return {
            ok: false,
            message: `Failed to reach remote endpoint: ${message}`,
            failureKind: 'remote_unreachable',
        };
    }
}
function getVerifyTimeoutMs() {
    const raw = process.env.MCPKG_VERIFY_TIMEOUT_MS;
    if (!raw) {
        return DEFAULT_VERIFY_TIMEOUT_MS;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_VERIFY_TIMEOUT_MS;
}
function classifyProcessExit(stderr, stdout) {
    const evidence = `${stderr}\n${stdout}`.toLowerCase();
    if (evidence.includes('too many arguments') || evidence.includes('expected 0 arguments')) {
        return 'too_many_arguments';
    }
    if (/(missing|required|not set).*(api|key|token|secret|url|uri|password|env)/.test(evidence)) {
        return 'missing_input';
    }
    if (evidence.includes('import: unable to grab mouse') ||
        evidence.includes('syntax error near unexpected token') ||
        evidence.includes('cannot use import statement outside a module')) {
        // Common npm packaging failure: package.json points "bin" at an ESM file
        // without a Node shebang, so the shell tries to execute JavaScript text.
        return 'invalid_launcher';
    }
    return 'process_exited';
}
function compactDetails(...chunks) {
    const details = chunks
        .map((chunk) => chunk.trim())
        .filter(Boolean)
        .map((chunk) => chunk.slice(0, 300));
    return details.length > 0 ? details : undefined;
}
function compactChunk(chunk) {
    const trimmed = chunk.trim();
    return trimmed ? trimmed.slice(0, 600) : undefined;
}
