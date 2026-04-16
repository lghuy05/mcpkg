export const MCPKG_GUIDE = `
Typical flow
  0. Configure optional agent support.
     mcpkg setup

  1. Find a server from a natural-language request.
     mcpkg find "PostgreSQL MCP server that runs with npx and supports stdio"

  2. Inspect the exact registry entry.
     mcpkg search "capital.hove/read-only-local-postgres-mcp-server"

  3. Install it into a target config.
     mcpkg install "capital.hove/read-only-local-postgres-mcp-server" --claude
     mcpkg install "capital.hove/read-only-local-postgres-mcp-server" --project

  4. Review or clean up installed servers.
     mcpkg list --claude
     mcpkg remove "capital.hove/read-only-local-postgres-mcp-server" --claude

Commands
  setup     Store user-level mcpkg settings.
  find      Agent-assisted recommendation from plain English.
  search    Registry search and exact server inspection.
  install   Build config, ask for inputs, verify startup, then write config.
  list      Show configured MCP servers.
  remove    Remove a configured MCP server.

Install behavior
  mcpkg reads registry metadata and README docs to infer required env vars,
  args, headers, and remote URL variables. It verifies the generated config
  before writing. If verification fails, it explains the failure and suggests
  relevant alternatives when possible.

Config targets
  --claude   Claude Desktop config
  --project  ./mcpkg.json

Useful environment variables
  GEMINI_API_KEY              Enables stronger agent reasoning.
  GEMINI_MODEL                Overrides the Gemini model name.
  MCPKG_VERIFY_TIMEOUT_MS     Changes MCP startup verification timeout.
  MCPKG_DEBUG=1               Prints internal decision logs.

Config storage
  macOS     ~/Library/Application Support/mcpkg/config.json
  Linux     ~/.config/mcpkg/config.json
  Windows   %APPDATA%\\mcpkg\\config.json
`.trim();
