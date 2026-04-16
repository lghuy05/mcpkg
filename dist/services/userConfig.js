import { existsSync, readFileSync } from 'node:fs';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-lite';
const CONFIG_FILE_NAME = 'config.json';
export function getUserConfigDir() {
    return getUserConfigDirForPlatform(os.platform(), process.env, os.homedir());
}
export function getUserConfigPath() {
    return path.join(getUserConfigDir(), CONFIG_FILE_NAME);
}
export function getUserConfigDirForPlatform(platform, env, homeDir) {
    if (platform === 'win32') {
        return path.join(env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'mcpkg');
    }
    if (platform === 'darwin') {
        return path.join(homeDir, 'Library', 'Application Support', 'mcpkg');
    }
    return path.join(env.XDG_CONFIG_HOME || path.join(homeDir, '.config'), 'mcpkg');
}
export async function loadUserConfig() {
    const configPath = getUserConfigPath();
    try {
        const raw = await readFile(configPath, 'utf8');
        return parseUserConfig(raw, configPath);
    }
    catch (error) {
        if (isNotFoundError(error)) {
            return {};
        }
        throw error;
    }
}
export function loadUserConfigSync() {
    const configPath = getUserConfigPath();
    if (!existsSync(configPath)) {
        return {};
    }
    return parseUserConfig(readFileSync(configPath, 'utf8'), configPath);
}
export async function saveUserConfig(config) {
    const configDir = getUserConfigDir();
    const configPath = getUserConfigPath();
    await mkdir(configDir, { recursive: true });
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    try {
        await chmod(configPath, 0o600);
    }
    catch {
        // Windows and some filesystems do not support POSIX modes.
    }
}
export function applyUserConfigToEnv(config) {
    if (config.geminiApiKey && process.env.GEMINI_API_KEY === undefined) {
        process.env.GEMINI_API_KEY = config.geminiApiKey;
    }
    if (config.geminiModel && process.env.GEMINI_MODEL === undefined) {
        process.env.GEMINI_MODEL = config.geminiModel;
    }
    if (config.verifyTimeoutMs && process.env.MCPKG_VERIFY_TIMEOUT_MS === undefined) {
        process.env.MCPKG_VERIFY_TIMEOUT_MS = String(config.verifyTimeoutMs);
    }
}
function parseUserConfig(raw, configPath) {
    if (!raw.trim()) {
        return {};
    }
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) {
        throw new Error(`${configPath} must contain a JSON object`);
    }
    const config = {};
    if (typeof parsed.geminiApiKey === 'string' && parsed.geminiApiKey.trim()) {
        config.geminiApiKey = parsed.geminiApiKey.trim();
    }
    if (typeof parsed.geminiModel === 'string' && parsed.geminiModel.trim()) {
        config.geminiModel = parsed.geminiModel.trim();
    }
    if (typeof parsed.verifyTimeoutMs === 'number' && Number.isFinite(parsed.verifyTimeoutMs)) {
        config.verifyTimeoutMs = parsed.verifyTimeoutMs;
    }
    return config;
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isNotFoundError(error) {
    return (typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT');
}
