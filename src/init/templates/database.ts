export const DATABASE_TEMPLATE = {
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

const server = new McpServer({
  name: "{{name}}",
  version: "1.0.0",
});

// Example: Query tool (replace with your database driver)
server.tool(
  "query",
  "Execute a read-only SQL query against the database",
  {
    sql: z.string().describe("SQL SELECT query to execute"),
  },
  async ({ sql }) => {
    // Validate read-only
    const normalized = sql.trim().toUpperCase();
    if (!normalized.startsWith("SELECT")) {
      return {
        content: [{ type: "text", text: "Error: Only SELECT queries are allowed" }],
        isError: true,
      };
    }

    // TODO: Replace with your database driver (pg, mysql2, better-sqlite3, etc.)
    return {
      content: [{ type: "text", text: \`Query executed: \${sql}\\n\\nReplace this stub with your database driver.\` }],
    };
  }
);

server.tool(
  "list_tables",
  "List all tables in the database",
  {},
  async () => {
    // TODO: Replace with actual table listing query
    return {
      content: [{ type: "text", text: "Tables: [Replace with your database driver]" }],
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
