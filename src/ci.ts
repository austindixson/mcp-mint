/**
 * mcp-forge ci — generate GitHub Actions CI workflow for MCP server testing.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function escapeShellArg(arg: string): string {
  if (/^[a-zA-Z0-9._\-/]+$/.test(arg)) return arg;
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

export function generateCiWorkflow(serverCommand: string, serverArgs: string[]): string {
  const escapedArgs = serverArgs.map(escapeShellArg).join(' ');
  const fullCommand = `npx mcp-mint test ${escapeShellArg(serverCommand)} ${escapedArgs} --json > mcp-report.json`;

  return `name: MCP Server CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  mcp-test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run MCP server tests
        run: ${fullCommand}

      - name: Check grade
        run: |
          GRADE=$(node -e "const r=JSON.parse(require('fs').readFileSync('mcp-report.json','utf8'));console.log(r.summary.grade)")
          echo "Grade: $GRADE"
          if [ "$GRADE" = "D" ] || [ "$GRADE" = "F" ]; then
            echo "::error::MCP server received grade $GRADE — failing build."
            exit 1
          fi

      - name: Upload MCP report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: mcp-report
          path: mcp-report.json
`;
}

export function writeCiWorkflow(
  projectDir: string,
  serverCommand: string,
  serverArgs: string[],
): void {
  const workflowDir = join(projectDir, '.github', 'workflows');
  mkdirSync(workflowDir, { recursive: true });
  const content = generateCiWorkflow(serverCommand, serverArgs);
  writeFileSync(join(workflowDir, 'mcp-ci.yml'), content, 'utf-8');
}
