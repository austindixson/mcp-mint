export const REST_API_TEMPLATE = {
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

// Example tool: fetch data from a REST API
server.tool(
  "fetch_data",
  "Fetch data from the configured API endpoint",
  {
    endpoint: z.string().describe("API endpoint path (e.g., /users/1)"),
    method: z.enum(["GET", "POST"]).default("GET").describe("HTTP method"),
  },
  async ({ endpoint, method }) => {
    const baseUrl = process.env.API_BASE_URL ?? "https://jsonplaceholder.typicode.com";
    const url = new URL(endpoint, baseUrl).toString();

    const response = await fetch(url, { method });

    if (!response.ok) {
      return {
        content: [{ type: "text", text: \`Error: \${response.status} \${response.statusText}\` }],
        isError: true,
      };
    }

    const data = await response.json();
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
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
