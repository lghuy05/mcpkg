# mcpkg

`mcpkg` is a community package manager for MCP servers. It helps users find an MCP server, infer its required configuration, verify that it starts, and write the final config to Claude Desktop or a project-local `mcpkg.json`.

## Current Flow

```bash
mcpkg setup
mcpkg find "PostgreSQL MCP server that runs with npx and supports stdio"
mcpkg search "capital.hove/read-only-local-postgres-mcp-server"
mcpkg install "capital.hove/read-only-local-postgres-mcp-server" --claude
mcpkg list --claude
```

The install command:

1. Searches the official MCP registry.
2. Resolves the best package or remote endpoint.
3. Reads registry metadata and README docs to infer required inputs.
4. Prompts for env vars, args, headers, or URL variables.
5. Verifies the generated MCP config.
6. Writes only after verification passes.

## Commands

```bash
mcpkg guide
```

Shows a practical usage guide in the terminal.

```bash
mcpkg setup
```

Stores user-level settings such as the optional Gemini API key. Config is stored in the correct per-user config directory for the operating system:

```text
macOS     ~/Library/Application Support/mcpkg/config.json
Linux     ~/.config/mcpkg/config.json
Windows   %APPDATA%\mcpkg\config.json
```

```bash
mcpkg find "<natural language request>"
```

Uses an agent when `GEMINI_API_KEY` is set. Without an API key, it falls back to local heuristics and ranking.

```bash
mcpkg search <query>
```

Searches registry metadata. If the query exactly matches a server name or ID, it prints detailed metadata.

```bash
mcpkg install <server> --claude
mcpkg install <server> --project
```

Builds and verifies an MCP config, then writes it to the selected target.

```bash
mcpkg install <server> --claude --force
```

Allows replacing an existing config with the same key, or intentionally adding another config with the same runtime.

```bash
mcpkg list --claude
mcpkg list --project
```

Lists configured MCP servers.

```bash
mcpkg remove <server> --claude
mcpkg remove <server> --project
```

Removes a configured MCP server.

## Environment

```bash
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash-lite
MCPKG_VERIFY_TIMEOUT_MS=30000
MCPKG_DEBUG=1
```

`mcpkg setup` stores these values for normal use. Environment variables still work and take precedence when already set. `GEMINI_API_KEY` enables stronger reasoning for natural-language search, README requirement extraction, and install retry suggestions.

## Architecture

```text
src/commands   CLI command handlers
src/services   Registry, planning, verification, config, and agent logic
src/types      Shared TypeScript interfaces
src/utils      Terminal output and shared presentation helpers
```

Important services:

- `registry.ts`: official MCP registry access.
- `findAgent.ts`: natural-language intent to registry candidates.
- `planner.ts`: registry package or remote metadata to an install plan.
- `installRequirementAnalyzer.ts`: registry and README input extraction.
- `installResolver.ts`: user answers to final MCP client config.
- `verify.ts`: MCP startup verification.
- `duplicates.ts`: duplicate config detection.
- `alternatives.ts`: relevant fallback recommendations after failed installs.

## Development

```bash
npm install
npm run build
npm test
npm run smoke
node dist/index.js guide
```

Before opening a pull request, at minimum run:

```bash
npm run build
npm test
npm run smoke
node dist/index.js list --project
node dist/index.js search postgres
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for project structure and pull request expectations.

## Design Principles

- Prefer registry metadata when it is available.
- Use README analysis to fill missing setup details.
- Verify generated configs before writing them.
- Do not silently overwrite existing configs.
- Keep output compact enough for terminal use.
- Avoid package-specific hardcoding; prefer evidence-driven fallback and verification.
