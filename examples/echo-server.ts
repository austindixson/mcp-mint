#!/usr/bin/env npx tsx
/**
 * Minimal MCP server for integration testing.
 * Exposes two tools: echo and add.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "echo-server",
  version: "1.0.0",
});

server.tool(
  "echo",
  "Echo back the input message",
  { message: z.string().describe("Message to echo back") },
  async ({ message }) => ({
    content: [{ type: "text", text: message }],
  }),
);

server.tool(
  "add",
  "Add two numbers together",
  {
    a: z.number().describe("First number"),
    b: z.number().describe("Second number"),
  },
  async ({ a, b }) => ({
    content: [{ type: "text", text: String(a + b) }],
  }),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
