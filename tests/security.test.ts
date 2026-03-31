import { describe, it, expect } from 'vitest';
import { scanToolResponse, scanToolDefinition, SECRET_PATTERNS } from '../src/test-runner/security.js';
import type { SecurityFinding, McpToolCallResult, ToolDefinition } from '../src/types/index.js';

describe('Security Scanner', () => {
  describe('SECRET_PATTERNS', () => {
    it('should detect AWS access keys', () => {
      const text = 'key: AKIAIOSFODNN7EXAMPLE';
      const match = SECRET_PATTERNS.some((p) => p.pattern.test(text));
      expect(match).toBe(true);
    });

    it('should detect GitHub tokens', () => {
      const text = 'token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh12345678';
      const match = SECRET_PATTERNS.some((p) => p.pattern.test(text));
      expect(match).toBe(true);
    });

    it('should detect generic API keys in key=value format', () => {
      const text = 'api_key=sk-proj-abc123def456ghi789';
      const match = SECRET_PATTERNS.some((p) => p.pattern.test(text));
      expect(match).toBe(true);
    });

    it('should not flag normal text', () => {
      const text = 'The weather in San Francisco is sunny today.';
      const match = SECRET_PATTERNS.some((p) => p.pattern.test(text));
      expect(match).toBe(false);
    });
  });

  describe('scanToolResponse', () => {
    it('should detect secrets in tool response text', () => {
      const response: McpToolCallResult = {
        content: [
          { type: 'text', text: 'Your key is AKIAIOSFODNN7EXAMPLE' },
        ],
      };

      const findings = scanToolResponse('my_tool', response);
      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(findings[0]).toMatchObject({
        category: 'secrets',
        severity: 'critical',
        tool: 'my_tool',
      });
    });

    it('should detect multiple secrets across content blocks', () => {
      const response: McpToolCallResult = {
        content: [
          { type: 'text', text: 'AWS key: AKIAIOSFODNN7EXAMPLE' },
          { type: 'text', text: 'GitHub: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh12345678' },
        ],
      };

      const findings = scanToolResponse('leaky_tool', response);
      expect(findings.length).toBeGreaterThanOrEqual(2);
    });

    it('should return empty for clean responses', () => {
      const response: McpToolCallResult = {
        content: [
          { type: 'text', text: 'Weather: 72F, sunny' },
        ],
      };

      const findings = scanToolResponse('weather', response);
      expect(findings).toEqual([]);
    });

    it('should detect SSRF-prone URLs in responses', () => {
      const response: McpToolCallResult = {
        content: [
          { type: 'text', text: 'Fetching http://169.254.169.254/latest/meta-data/' },
        ],
      };

      const findings = scanToolResponse('fetcher', response);
      expect(findings).toContainEqual(
        expect.objectContaining({
          category: 'ssrf',
          severity: 'critical',
        }),
      );
    });

    it('should detect internal IP addresses in responses', () => {
      const response: McpToolCallResult = {
        content: [
          { type: 'text', text: 'Connected to http://192.168.1.100:8080/admin' },
        ],
      };

      const findings = scanToolResponse('connector', response);
      expect(findings).toContainEqual(
        expect.objectContaining({
          category: 'ssrf',
          severity: 'high',
        }),
      );
    });

    it('should detect path traversal patterns', () => {
      const response: McpToolCallResult = {
        content: [
          { type: 'text', text: 'Reading file: ../../../etc/passwd' },
        ],
      };

      const findings = scanToolResponse('file_reader', response);
      expect(findings).toContainEqual(
        expect.objectContaining({
          category: 'path_traversal',
          severity: 'high',
        }),
      );
    });
  });

  describe('scanToolDefinition', () => {
    it('should flag tools that accept raw URLs without description of validation', () => {
      const tool: ToolDefinition = {
        name: 'fetch_url',
        description: 'Fetch a URL',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL to fetch' },
          },
        },
      };

      const findings = scanToolDefinition(tool);
      expect(findings).toContainEqual(
        expect.objectContaining({
          category: 'ssrf',
          severity: 'medium',
          tool: 'fetch_url',
        }),
      );
    });

    it('should flag tools that accept file paths', () => {
      const tool: ToolDefinition = {
        name: 'read_file',
        description: 'Read a file from disk',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path to read' },
          },
        },
      };

      const findings = scanToolDefinition(tool);
      expect(findings).toContainEqual(
        expect.objectContaining({
          category: 'path_traversal',
          severity: 'medium',
          tool: 'read_file',
        }),
      );
    });

    it('should flag tools that accept shell commands', () => {
      const tool: ToolDefinition = {
        name: 'run_command',
        description: 'Execute a shell command',
        inputSchema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Shell command to run' },
          },
        },
      };

      const findings = scanToolDefinition(tool);
      expect(findings).toContainEqual(
        expect.objectContaining({
          category: 'injection',
          severity: 'high',
          tool: 'run_command',
        }),
      );
    });

    it('should return empty for safe tool definitions', () => {
      const tool: ToolDefinition = {
        name: 'add_numbers',
        description: 'Add two numbers together',
        inputSchema: {
          type: 'object',
          properties: {
            a: { type: 'number', description: 'First number' },
            b: { type: 'number', description: 'Second number' },
          },
        },
      };

      const findings = scanToolDefinition(tool);
      expect(findings).toEqual([]);
    });
  });
});
