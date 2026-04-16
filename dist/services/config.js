export function parseMcpConfig(raw, sourceName) {
    if (raw.trim() === '') {
        return { mcpServers: {} };
    }
    const parsed = JSON.parse(raw);
    return normalizeMcpConfig(parsed, sourceName);
}
export function normalizeMcpConfig(value, sourceName) {
    if (!isRecord(value)) {
        throw new Error(`${sourceName} must contain a JSON object`);
    }
    const rawServers = value.mcpServers;
    if (rawServers === undefined) {
        return {
            ...value,
            mcpServers: {},
        };
    }
    if (!isRecord(rawServers)) {
        throw new Error(`${sourceName}.mcpServers must be an object`);
    }
    const mcpServers = {};
    for (const [name, config] of Object.entries(rawServers)) {
        if (!isClientMcpConfig(config)) {
            throw new Error(`${sourceName}.mcpServers["${name}"] is not a valid MCP config`);
        }
        mcpServers[name] = config;
    }
    return {
        ...value,
        mcpServers,
    };
}
function isClientMcpConfig(value) {
    if (!isRecord(value)) {
        return false;
    }
    if (typeof value.command === 'string' && Array.isArray(value.args)) {
        return value.args.every((arg) => typeof arg === 'string');
    }
    return typeof value.type === 'string' && typeof value.url === 'string';
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
