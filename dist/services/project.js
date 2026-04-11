import { readFile, writeFile } from "node:fs/promises";
export function upsertProjectServer(existingConfig, serverKey, localConfig) {
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
