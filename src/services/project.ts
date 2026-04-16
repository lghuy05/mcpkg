import { readFile, writeFile } from "node:fs/promises";
import { ClientMcpConfig, ProjectMcpConfig } from "../types/mcp.js";
import { parseMcpConfig } from "./config.js";

export function upsertProjectServer(existingConfig: ProjectMcpConfig, serverKey: string, config: ClientMcpConfig) {
  return {
    ...existingConfig,
    mcpServers: {
      ...existingConfig.mcpServers,
      [serverKey]: config

    }
  };

}

export function removeProjectServer(existingConfig: ProjectMcpConfig, serverKey: string) {
  const { [serverKey]: _removed, ...remainingServers } = existingConfig.mcpServers ?? {};

  return {
    ...existingConfig,
    mcpServers: remainingServers
  };
}

export async function loadProjectConfig() {
  try {
    const raw = await readFile("mcpkg.json", "utf8");

    return parseMcpConfig(raw, "mcpkg.json");
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

export async function saveProjectConfig(config: ProjectMcpConfig) {
  await writeFile("mcpkg.json", JSON.stringify(config, null, 2), "utf8");
}
