import { readFile, writeFile } from "node:fs/promises";
import { EnvironmentVariable, LocalCommandConfig, ProjectMcpConfig } from "../types/mcp.js";

export function upsertProjectServer(existingConfig: ProjectMcpConfig, serverKey: string, localConfig: LocalCommandConfig) {
  return {
    ...existingConfig,
    mcpServers: {
      ...existingConfig.mcpServers,
      [serverKey]: localConfig

    }
  };

}

export async function loadProjectConfig() {
  try {
    const raw = await readFile("mcpkg.json", "utf8");

    if (raw.trim() === "") {
      return {
        mcpServers: {}
      };
    }

    const parsed = JSON.parse(raw);
    return parsed;
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
