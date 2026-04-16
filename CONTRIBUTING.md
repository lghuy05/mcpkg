# Contributing

Thanks for helping improve `mcpkg`. The project is still early, so changes should stay small, explainable, and covered by focused tests.

## Development Loop

```bash
npm install
npm run build
npm test
npm run smoke
```

Use local commands while developing:

```bash
node dist/index.js guide
node dist/index.js setup --show-path
node dist/index.js search postgres
node dist/index.js find "PostgreSQL MCP server that runs with npx and supports stdio"
```

## Code Organization

```text
src/commands   Thin CLI handlers. Parse options, call services, print results.
src/services   Product logic: registry, planning, requirement extraction, verification.
src/types      Shared TypeScript contracts.
src/utils      Presentation helpers and CLI guide text.
```

Keep command files thin. If a command needs real logic, put that logic in `src/services`.

## Testing

Prefer tests for pure service logic:

- duplicate config detection
- config parsing and validation
- install plan resolution
- ranking and candidate filtering
- failure classification

Avoid tests that depend on the live MCP registry unless they are explicitly marked as smoke tests. Registry responses change over time.

## Design Rules

- Do not silently write unverified config.
- Do not silently overwrite existing config.
- Prefer registry metadata over README inference.
- Use README inference to fill missing setup details.
- Avoid server-specific hardcoding. If a package is broken, classify the failure and recommend alternatives.
- Keep terminal output compact and actionable.

## Pull Request Checklist

- `npm run build` passes.
- `npm test` passes.
- `npm run smoke` passes before release.
- New behavior has a focused test when practical.
- User-facing command output is short enough to read in a terminal.
- README or guide text is updated when commands or behavior change.
