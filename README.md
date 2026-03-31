# MCP Forge

Test, validate, and scaffold MCP servers. Think ESLint for the Model Context Protocol.

MCP Forge checks your MCP server for protocol compliance, schema correctness, and security vulnerabilities before you ship it to users.

## Install

```bash
npm install -g mcp-mint
```

## Quick Start

### Test a running MCP server

```bash
# Test any MCP server that communicates over stdio
mcp-mint test node my-server.js
mcp-mint test python3 server.py
mcp-mint test npx tsx src/index.ts

# Choose specific test suites
mcp-mint test node server.js --suite schema,security

# Output as JSON (for CI pipelines)
mcp-mint test node server.js --json
```

### Validate offline (no server needed)

Create a `manifest.json` describing your tools:

```json
{
  "name": "my-server",
  "version": "1.0.0",
  "tools": [
    {
      "name": "get_weather",
      "description": "Get current weather for a location",
      "inputSchema": {
        "type": "object",
        "properties": {
          "city": { "type": "string", "description": "City name" }
        },
        "required": ["city"]
      }
    }
  ]
}
```

```bash
mcp-mint validate manifest.json
mcp-mint validate manifest.json --json
```

### Scaffold a new MCP server

```bash
# REST API wrapper (default)
mcp-mint init my-api-server --template rest-api

# Database connector
mcp-mint init my-db-server --template database

# File system tools
mcp-mint init my-fs-server --template filesystem
```

Each template includes TypeScript, MCP SDK, and a working server you can run immediately.

## What It Tests

### Schema Validation
- Tool names are valid (alphanumeric, no duplicates)
- Descriptions are present and descriptive
- Input schemas use `type: "object"` with defined properties

### Protocol Compliance
- Server returns valid `protocolVersion` and `serverInfo`
- `tools/list` returns a proper tools array
- `tools/call` responses include `content` with typed blocks

### Security Scanning
- **Secrets detection**: AWS keys, GitHub tokens, Anthropic/OpenAI keys, private keys, generic API keys
- **SSRF risk**: Tools accepting URL parameters, responses referencing internal IPs or cloud metadata endpoints
- **Path traversal**: `../` patterns in responses, tools accepting file path parameters
- **Command injection**: Tools accepting shell command parameters

### Grading

Every test run produces a grade from **A** to **F**:

| Grade | Meaning |
|-------|---------|
| A | No failures, minimal warnings |
| B | Very few failures (<5%), some warnings |
| C | Moderate failures (<15%) |
| D | Significant failures (<30%) |
| F | Critical issues (>30% failure rate) |

## CI Integration

### GitHub Actions

```yaml
- name: Test MCP Server
  run: npx mcp-mint test node dist/server.js --json > mcp-report.json

- name: Check grade
  run: |
    grade=$(jq -r '.summary.grade' mcp-report.json)
    if [ "$grade" = "F" ] || [ "$grade" = "D" ]; then
      echo "MCP server failed quality gate: grade $grade"
      exit 1
    fi
```

## Development

```bash
git clone https://github.com/your-org/mcp-mint.git
cd mcp-mint
npm install
npm test                    # 91 tests
npx vitest run --coverage   # 98%+ coverage
```

## Project Structure

```
src/
  cli.ts                  # CLI entry point (Commander.js)
  validate.ts             # Offline manifest validation
  test-runner/
    schema.ts             # Tool schema validation
    protocol.ts           # MCP protocol compliance checks
    security.ts           # Security vulnerability scanning
    performance.ts        # Latency benchmarking utilities
    index.ts              # Test orchestrator + grading
  init/
    index.ts              # Scaffolding engine
    templates/            # rest-api, database, filesystem
  types/
    index.ts              # Shared type definitions
  utils/
    logger.ts             # Colored terminal output
tests/                    # 91 tests (unit + integration)
examples/
  echo-server.ts          # Minimal MCP server for testing
```

## License

MIT
