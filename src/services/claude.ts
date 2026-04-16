import { readFile, writeFile } from "node:fs/promises";
import { ClaudeMcpConfig, ClientMcpConfig } from "../types/mcp.js";
import path from "node:path";
import os from "node:os";
import { parseMcpConfig } from "./config.js";

export function getClaudeConfigPath(): string {
  const home = os.homedir();
  if (os.platform() === "win32") {
    const appData = process.env.APPDATA;
    if (!appData) {
      throw new Error("APPDATA is not set");
    }
    return path.join(appData, "Claude", "claude_desktop_config.json");
  }
  if (os.platform() === "linux") {
    return path.join(home, ".config", "Claude", "claude_desktop_config.json");
  }
  if (os.platform() === "darwin") {
    return path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json");
  }
  throw new Error("Unsupported platform for Claude config path");
}

export function upsertClaudeServer(existingConfig: ClaudeMcpConfig, serverKey: string, config: ClientMcpConfig) {
  return {
    ...existingConfig,
    mcpServers: {
      ...existingConfig.mcpServers,
      [serverKey]: config
    }
  };

}

export function removeClaudeServer(existingConfig: ClaudeMcpConfig, serverKey: string) {
  const { [serverKey]: _removed, ...remainingServers } = existingConfig.mcpServers ?? {};

  return {
    ...existingConfig,
    mcpServers: remainingServers
  };
}

export async function loadClaudeConfig() {
  try {
    const path = getClaudeConfigPath();
    const raw = await readFile(path, "utf8");

    return parseMcpConfig(raw, path) as ClaudeMcpConfig;
  } catch (error) {
    if (
      typeof error === "object" &&
      error != null &&
      "code" in error &&
      error.code === "ENOENT") {
      return {
        mcpServers: {}
      };
    }
    throw error;
  }
}

export async function saveClaudeConfig(config: ClaudeMcpConfig) {
  const path = getClaudeConfigPath();
  await writeFile(path, JSON.stringify(config, null, 2), "utf8");
}
