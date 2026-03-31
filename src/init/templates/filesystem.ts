export const FILESYSTEM_TEMPLATE = {
  'package.json': `{
  "name": "{{name}}",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node dist/index.js",
    "build": "tsc",
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.1",
    "zod": "^3.24.4"
  },
  "devDependencies": {
    "@types/node": "^22.15.3",
    "tsx": "^4.19.4",
    "typescript": "^5.8.3"
  }
}`,

  'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}`,

  'src/index.ts': `#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readdir, readFile, stat } from "node:fs/promises";
import { resolve, relative, join } from "node:path";

const ALLOWED_ROOT = process.env.MCP_ROOT_DIR ?? process.cwd();

function safePath(requested: string): string {
  const resolved = resolve(ALLOWED_ROOT, requested);
  if (!resolved.startsWith(resolve(ALLOWED_ROOT))) {
    throw new Error("Path traversal detected");
  }
  return resolved;
}

const server = new McpServer({
  name: "{{name}}",
  version: "1.0.0",
});

server.tool(
  "list_files",
  "List files in a directory",
  {
    path: z.string().default(".").describe("Relative directory path"),
  },
  async ({ path }) => {
    const dir = safePath(path);
    const entries = await readdir(dir, { withFileTypes: true });
    const listing = entries.map((e) => \`\${e.isDirectory() ? "[dir]" : "[file]"} \${e.name}\`);
    return {
      content: [{ type: "text", text: listing.join("\\n") || "(empty directory)" }],
    };
  }
);

server.tool(
  "read_file",
  "Read a file's contents",
  {
    path: z.string().describe("Relative file path"),
  },
  async ({ path }) => {
    const filePath = safePath(path);
    const info = await stat(filePath);
    if (info.size > 1_000_000) {
      return {
        content: [{ type: "text", text: "Error: File too large (>1MB)" }],
        isError: true,
      };
    }
    const content = await readFile(filePath, "utf-8");
    return {
      content: [{ type: "text", text: content }],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
`,
} as const;
