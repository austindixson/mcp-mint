import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { validateToolDefinitions } from '../src/test-runner/schema.js';
import {
  validateInitializeResult,
  validateToolListResult,
  validateToolCallResult,
} from '../src/test-runner/protocol.js';
import { scanToolDefinition, scanToolResponse } from '../src/test-runner/security.js';
import type { ToolDefinition, McpToolCallResult } from '../src/types/index.js';

describe('Integration: Echo Server', () => {
  let client: Client;
  let transport: StdioClientTransport;

  async function connect() {
    transport = new StdioClientTransport({
      command: 'npx',
      args: ['tsx', 'examples/echo-server.ts'],
      cwd: process.env.PROJECT_ROOT || process.cwd(),
    });

    client = new Client(
      { name: 'mcp-mint-test', version: '0.1.0' },
      { capabilities: {} },
    );

    await client.connect(transport);
  }

  async function disconnect() {
    try {
      await client?.close();
    } catch {
      // server may already be closed
    }
  }

  it('should connect and get valid server info', async () => {
    await connect();
    try {
      // getServerVersion() returns Implementation | undefined after connect()
      const serverVersion = client.getServerVersion?.();
      expect(serverVersion).toBeDefined();
      expect(serverVersion?.name).toBe('echo-server');
      expect(serverVersion?.version).toBe('1.0.0');

      // getServerVersion() returns { name, version } after successful handshake
      // The protocol version is negotiated during connect() — if we got here, it passed
      expect(serverVersion?.name).toBeTruthy();
      expect(serverVersion?.version).toBeTruthy();
    } finally {
      await disconnect();
    }
  }, 15000);

  it('should list tools with valid schemas', async () => {
    await connect();
    try {
      const toolList = await client.listTools();

      // Protocol validation
      const protocolResults = validateToolListResult(toolList as any);
      expect(protocolResults.filter((r) => r.status === 'fail')).toEqual([]);

      // Schema validation
      const tools = toolList.tools as unknown as ToolDefinition[];
      expect(tools.length).toBe(2);

      const schemaViolations = validateToolDefinitions(tools);
      expect(schemaViolations).toEqual([]);

      // Should have echo and add
      const names = tools.map((t) => t.name);
      expect(names).toContain('echo');
      expect(names).toContain('add');
    } finally {
      await disconnect();
    }
  }, 15000);

  it('should pass security scan on tool definitions', async () => {
    await connect();
    try {
      const { tools } = await client.listTools();

      for (const tool of tools) {
        const findings = scanToolDefinition(tool as unknown as ToolDefinition);
        // echo + add are safe tools — no URL/path/command params
        expect(findings).toEqual([]);
      }
    } finally {
      await disconnect();
    }
  }, 15000);

  it('should call echo tool and get valid response', async () => {
    await connect();
    try {
      const result = await client.callTool({
        name: 'echo',
        arguments: { message: 'hello world' },
      });

      // Protocol validation
      const protocolResults = validateToolCallResult(result as any);
      expect(protocolResults.filter((r) => r.status === 'fail')).toEqual([]);

      // Content check
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0]?.text).toBe('hello world');

      // Security scan on response
      const secFindings = scanToolResponse('echo', result as unknown as McpToolCallResult);
      expect(secFindings).toEqual([]);
    } finally {
      await disconnect();
    }
  }, 15000);

  it('should call add tool and get correct result', async () => {
    await connect();
    try {
      const result = await client.callTool({
        name: 'add',
        arguments: { a: 3, b: 7 },
      });

      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0]?.text).toBe('10');
    } finally {
      await disconnect();
    }
  }, 15000);

  it('should detect secrets in tool response if leaked', async () => {
    // Simulate scanning a response that contains a secret
    const fakeResponse: McpToolCallResult = {
      content: [{ type: 'text', text: 'config: AKIAIOSFODNN7EXAMPLE' }],
    };

    const findings = scanToolResponse('echo', fakeResponse);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0]?.category).toBe('secrets');
  });
});
