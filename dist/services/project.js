import { readFile, writeFile } from "node:fs/promises";
import { parseMcpConfig } from "./config.js";
export function upsertProjectServer(existingConfig, serverKey, config) {
    return {
        ...existingConfig,
        mcpServers: {
            ...existingConfig.mcpServers,
            [serverKey]: config
        }
    };
}
export function removeProjectServer(existingConfig, serverKey) {
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
    }
    catch (error) {
        if (typeof error === "object" &&
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
export async function saveProjectConfig(config) {
    await writeFile("mcpkg.json", JSON.stringify(config, null, 2), "utf8");
}
