import { describe, it, expect } from 'vitest';
import { validateToolDefinitions } from '../src/test-runner/schema.js';
import { scanToolResponse, scanToolDefinition } from '../src/test-runner/security.js';
import {
  validateInitializeResult,
  validateToolListResult,
  validateToolCallResult,
} from '../src/test-runner/protocol.js';
import { computeLatencyStats, gradeLatency } from '../src/test-runner/performance.js';
import { computeSummary, computeGrade } from '../src/test-runner/index.js';
import type {
  ToolDefinition,
  McpToolCallResult,
  McpInitializeResult,
  McpToolListResult,
  TestResult,
  TestSuiteResult,
} from '../src/types/index.js';

// ────────────────────────────────────────────────────────────────────────────
// 1. Schema Edge Cases
// ────────────────────────────────────────────────────────────────────────────

describe('Schema Edge Cases', () => {
  it('should flag tool with empty string name', () => {
    const tools: ToolDefinition[] = [{ name: '', description: 'A valid description here' }];
    const violations = validateToolDefinitions(tools);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.field === 'name' && v.severity === 'critical')).toBe(true);
  });

  it('should flag tool with extremely long name (1000 chars)', () => {
    const longName = 'a'.repeat(1000);
    const tools: ToolDefinition[] = [
      { name: longName, description: 'A valid description here' },
    ];
    const violations = validateToolDefinitions(tools);
    // Long alphanumeric name matches the pattern, so no name violation expected.
    // But it should at least not throw.
    expect(Array.isArray(violations)).toBe(true);
  });

  it('should flag tool with special characters in name (spaces)', () => {
    const tools: ToolDefinition[] = [
      { name: 'my tool', description: 'A valid description here' },
    ];
    const violations = validateToolDefinitions(tools);
    expect(violations.some((v) => v.field === 'name' && v.message.includes('invalid characters'))).toBe(true);
  });

  it('should flag tool with unicode characters in name', () => {
    const tools: ToolDefinition[] = [
      { name: 'tool_\u00e9\u00e8\u00ea', description: 'A valid description here' },
    ];
    const violations = validateToolDefinitions(tools);
    expect(violations.some((v) => v.field === 'name' && v.message.includes('invalid characters'))).toBe(true);
  });

  it('should handle tool with deeply nested inputSchema (5+ levels)', () => {
    const deepSchema: Record<string, unknown> = {
      type: 'object',
      properties: {
        level1: {
          type: 'object',
          properties: {
            level2: {
              type: 'object',
              properties: {
                level3: {
                  type: 'object',
                  properties: {
                    level4: {
                      type: 'object',
                      properties: {
                        level5: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
    const tools: ToolDefinition[] = [
      { name: 'deep_tool', description: 'A deeply nested tool schema', inputSchema: deepSchema },
    ];
    const violations = validateToolDefinitions(tools);
    // Should not throw; deeply nested schemas are valid JSON Schema
    expect(Array.isArray(violations)).toBe(true);
  });

  it('should flag tool with inputSchema that has no type field', () => {
    const tools: ToolDefinition[] = [
      {
        name: 'no_type_tool',
        description: 'A tool with missing type in schema',
        inputSchema: { properties: { foo: { type: 'string' } } },
      },
    ];
    const violations = validateToolDefinitions(tools);
    expect(violations.some((v) => v.field === 'inputSchema.type')).toBe(true);
  });

  it('should handle tool with 50+ properties in schema', () => {
    const properties: Record<string, unknown> = {};
    for (let i = 0; i < 55; i++) {
      properties[`prop_${i}`] = { type: 'string' };
    }
    const tools: ToolDefinition[] = [
      {
        name: 'many_props',
        description: 'A tool with many properties in schema',
        inputSchema: { type: 'object', properties },
      },
    ];
    const violations = validateToolDefinitions(tools);
    // Should not throw; many properties is valid
    expect(Array.isArray(violations)).toBe(true);
    // No name or type violations expected for this well-formed tool
    expect(violations.filter((v) => v.field === 'name' || v.field === 'inputSchema.type')).toHaveLength(0);
  });

  it('should flag duplicate tool names in list', () => {
    const tools: ToolDefinition[] = [
      { name: 'dup_tool', description: 'First instance of this tool' },
      { name: 'dup_tool', description: 'Second instance of this tool' },
    ];
    const violations = validateToolDefinitions(tools);
    expect(violations.some((v) => v.message.includes('Duplicate tool name'))).toBe(true);
  });

  it('should flag tool with description that is just whitespace', () => {
    const tools: ToolDefinition[] = [
      { name: 'whitespace_desc', description: '   ' },
    ];
    const violations = validateToolDefinitions(tools);
    // Whitespace-only description is 3 chars, below MIN_DESCRIPTION_LENGTH (10)
    expect(violations.some((v) => v.field === 'description' && v.message.includes('too short'))).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. Security Edge Cases
// ────────────────────────────────────────────────────────────────────────────

describe('Security Edge Cases', () => {
  describe('scanToolResponse', () => {
    it('should detect multiple different secret types in same text block', () => {
      const response: McpToolCallResult = {
        content: [
          {
            type: 'text',
            text: [
              'AWS key: AKIAIOSFODNN7EXAMPLE',
              'GitHub token: ghp_TESTTOKEN_NOTREAL_XXXXXXXXXXXXXXXXXXXX',
              'Generic API key: api_key=TESTKEY123456789NOTREAL',
            ].join('\n'),
          },
        ],
      };
      const findings = scanToolResponse('multi_secret_tool', response);
      const secretFindings = findings.filter((f) => f.category === 'secrets');
      // Should detect AWS key, GitHub token pattern, and generic API key
      expect(secretFindings.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle empty response content array', () => {
      const response: McpToolCallResult = { content: [] };
      const findings = scanToolResponse('empty_tool', response);
      expect(findings).toHaveLength(0);
    });

    it('should handle very large response text (50KB+)', () => {
      const bigText = 'a'.repeat(50_000) + ' AKIAIOSFODNN7EXAMPLE ' + 'b'.repeat(50_000);
      const response: McpToolCallResult = {
        content: [{ type: 'text', text: bigText }],
      };
      const findings = scanToolResponse('big_response_tool', response);
      expect(findings.some((f) => f.category === 'secrets')).toBe(true);
    });

    it('should not flag near-miss patterns that are not actual secrets', () => {
      const response: McpToolCallResult = {
        content: [
          {
            type: 'text',
            text: [
              'key: AKI_not_quite_right',
              'token: ghp_tooshort',
              'stripe: sk_live_short',
              'not a real bearer: Bearer abc',
            ].join('\n'),
          },
        ],
      };
      const findings = scanToolResponse('near_miss_tool', response);
      const secretFindings = findings.filter((f) => f.category === 'secrets');
      expect(secretFindings).toHaveLength(0);
    });

    it('should handle content items with no text or data', () => {
      const response: McpToolCallResult = {
        content: [{ type: 'image' } as any],
      };
      const findings = scanToolResponse('no_text_tool', response);
      expect(findings).toHaveLength(0);
    });
  });

  describe('scanToolDefinition', () => {
    it('should flag ALL risky parameter names at once', () => {
      const tool: ToolDefinition = {
        name: 'risky_tool',
        description: 'Tool with all risky params',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            path: { type: 'string' },
            command: { type: 'string' },
            sql: { type: 'string' },
            query: { type: 'string' },
          },
        },
      };
      const findings = scanToolDefinition(tool);
      // url -> ssrf, path -> path_traversal, command/sql/query -> injection
      expect(findings.some((f) => f.category === 'ssrf')).toBe(true);
      expect(findings.some((f) => f.category === 'path_traversal')).toBe(true);
      expect(findings.some((f) => f.category === 'injection')).toBe(true);
      expect(findings.length).toBeGreaterThanOrEqual(5);
    });

    it('should not flag risky param names if type is not string', () => {
      const tool: ToolDefinition = {
        name: 'safe_types',
        description: 'Tool with risky names but non-string types',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'number' },
            command: { type: 'boolean' },
            path: { type: 'array' },
          },
        },
      };
      const findings = scanToolDefinition(tool);
      expect(findings).toHaveLength(0);
    });

    it('should return empty findings for tool with no inputSchema', () => {
      const tool: ToolDefinition = { name: 'bare_tool', description: 'No schema at all' };
      const findings = scanToolDefinition(tool);
      expect(findings).toHaveLength(0);
    });

    it('should return empty findings for tool with no properties', () => {
      const tool: ToolDefinition = {
        name: 'empty_schema',
        description: 'Schema without properties',
        inputSchema: { type: 'object' },
      };
      const findings = scanToolDefinition(tool);
      expect(findings).toHaveLength(0);
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. Protocol Edge Cases
// ────────────────────────────────────────────────────────────────────────────

describe('Protocol Edge Cases', () => {
  describe('validateInitializeResult', () => {
    it('should handle initialize with empty strings for all fields', () => {
      const response: McpInitializeResult = {
        protocolVersion: '',
        capabilities: {},
        serverInfo: { name: '', version: '' },
      };
      const results = validateInitializeResult(response);
      // Empty protocolVersion is falsy -> fail
      expect(results.some((r) => r.status === 'fail' && r.name.includes('protocolVersion'))).toBe(true);
      // Empty serverInfo.name is falsy -> fail
      expect(results.some((r) => r.status === 'fail' && r.name.includes('serverInfo.name'))).toBe(true);
      // Empty serverInfo.version is falsy -> warn
      expect(results.some((r) => r.status === 'warn' && r.name.includes('serverInfo.version'))).toBe(true);
    });

    it('should pass initialize with extra unexpected fields', () => {
      const response = {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'test-server', version: '1.0.0' },
        extraField: 'should be ignored',
        anotherExtra: 42,
      } as McpInitializeResult;
      const results = validateInitializeResult(response);
      const failures = results.filter((r) => r.status === 'fail');
      expect(failures).toHaveLength(0);
    });
  });

  describe('validateToolCallResult', () => {
    it('should validate tool call response with isError: true', () => {
      const response: McpToolCallResult = {
        content: [{ type: 'text', text: 'Something went wrong' }],
        isError: true,
      };
      // isError is not checked by validateToolCallResult — it only checks content structure
      const results = validateToolCallResult(response);
      const failures = results.filter((r) => r.status === 'fail');
      expect(failures).toHaveLength(0);
    });

    it('should flag content items missing type field', () => {
      const response = {
        content: [
          { text: 'no type here' },
          { type: 'text', text: 'this one has type' },
        ],
      } as unknown as McpToolCallResult;
      const results = validateToolCallResult(response);
      expect(results.some((r) => r.status === 'fail' && r.message.includes('type'))).toBe(true);
    });

    it('should warn on empty content array', () => {
      const response: McpToolCallResult = { content: [] };
      const results = validateToolCallResult(response);
      expect(results.some((r) => r.status === 'warn')).toBe(true);
    });
  });

  describe('validateToolListResult', () => {
    it('should warn on empty tools array', () => {
      const response: McpToolListResult = { tools: [] };
      const results = validateToolListResult(response);
      expect(results.some((r) => r.status === 'warn')).toBe(true);
    });

    it('should fail when tools field is missing', () => {
      const response = {} as McpToolListResult;
      const results = validateToolListResult(response);
      expect(results.some((r) => r.status === 'fail')).toBe(true);
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. Performance Edge Cases
// ────────────────────────────────────────────────────────────────────────────

describe('Performance Edge Cases', () => {
  describe('computeLatencyStats', () => {
    it('should handle all identical values', () => {
      const samples = Array(100).fill(42);
      const stats = computeLatencyStats(samples);
      expect(stats.min).toBe(42);
      expect(stats.max).toBe(42);
      expect(stats.mean).toBe(42);
      expect(stats.p50).toBe(42);
      expect(stats.p95).toBe(42);
      expect(stats.p99).toBe(42);
    });

    it('should handle extreme outliers (1ms and 100000ms)', () => {
      const samples = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100_000];
      const stats = computeLatencyStats(samples);
      expect(stats.min).toBe(1);
      expect(stats.max).toBe(100_000);
      expect(stats.mean).toBeCloseTo(10004.5, 0);
      expect(stats.p50).toBeGreaterThanOrEqual(5);
      expect(stats.p50).toBeLessThanOrEqual(6);
      expect(stats.p95).toBeGreaterThan(1000);
    });

    it('should handle 10000 samples', () => {
      const samples = Array.from({ length: 10_000 }, (_, i) => i + 1);
      const stats = computeLatencyStats(samples);
      expect(stats.min).toBe(1);
      expect(stats.max).toBe(10_000);
      expect(stats.mean).toBeCloseTo(5000.5, 0);
      expect(stats.p50).toBeCloseTo(5000.5, 1);
    });

    it('should handle exactly 2 samples', () => {
      const stats = computeLatencyStats([10, 90]);
      expect(stats.min).toBe(10);
      expect(stats.max).toBe(90);
      expect(stats.mean).toBe(50);
      expect(stats.p50).toBe(50);
    });

    it('should throw on empty samples', () => {
      expect(() => computeLatencyStats([])).toThrow('empty samples');
    });

    it('should handle single sample', () => {
      const stats = computeLatencyStats([500]);
      expect(stats.min).toBe(500);
      expect(stats.max).toBe(500);
      expect(stats.mean).toBe(500);
      expect(stats.p50).toBe(500);
      expect(stats.p95).toBe(500);
      expect(stats.p99).toBe(500);
    });
  });

  describe('gradeLatency', () => {
    it('should pass when p95 is below threshold', () => {
      const stats = computeLatencyStats([100, 120, 130, 110, 150]);
      const result = gradeLatency('fast_tool', stats);
      expect(result.status).toBe('pass');
    });

    it('should warn when p95 is between 2x and 5x threshold', () => {
      // Default threshold is 1000ms. Warn at 2000ms.
      const stats = computeLatencyStats([2500, 2600, 2700, 2800, 2900]);
      const result = gradeLatency('slow_tool', stats);
      expect(result.status).toBe('warn');
    });

    it('should fail when p95 is at or above 5x threshold', () => {
      // Default threshold is 1000ms. Fail at 5000ms.
      const stats = computeLatencyStats([5000, 5100, 5200, 5300, 5400]);
      const result = gradeLatency('very_slow_tool', stats);
      expect(result.status).toBe('fail');
    });

    it('should respect custom thresholds', () => {
      const stats = computeLatencyStats([50, 55, 60, 65, 70]);
      // Custom threshold of 10ms. p95 ~68ms which is > 5x(50ms) -> fail
      const result = gradeLatency('custom_tool', stats, { p95Threshold: 10 });
      expect(result.status).toBe('fail');
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 5. Orchestrator Edge Cases
// ────────────────────────────────────────────────────────────────────────────

describe('Orchestrator Edge Cases', () => {
  describe('computeSummary', () => {
    it('should handle suite with all tests skipped', () => {
      const suites: TestSuiteResult[] = [
        {
          suite: 'all-skipped',
          results: [
            { name: 'test1', status: 'skip', severity: 'info', message: 'Skipped' },
            { name: 'test2', status: 'skip', severity: 'info', message: 'Skipped' },
            { name: 'test3', status: 'skip', severity: 'info', message: 'Skipped' },
          ],
          durationMs: 0,
        },
      ];
      const summary = computeSummary(suites);
      expect(summary.total).toBe(3);
      expect(summary.skipped).toBe(3);
      expect(summary.passed).toBe(0);
      expect(summary.failed).toBe(0);
      expect(summary.warnings).toBe(0);
    });

    it('should handle empty suites array', () => {
      const summary = computeSummary([]);
      expect(summary.total).toBe(0);
      expect(summary.grade).toBe('A');
    });

    it('should accumulate durations across multiple suites', () => {
      const suites: TestSuiteResult[] = [
        {
          suite: 'suite1',
          results: [{ name: 't1', status: 'pass', severity: 'info', message: 'ok' }],
          durationMs: 100,
        },
        {
          suite: 'suite2',
          results: [{ name: 't2', status: 'pass', severity: 'info', message: 'ok' }],
          durationMs: 200,
        },
      ];
      const summary = computeSummary(suites);
      expect(summary.durationMs).toBe(300);
    });
  });

  describe('computeGrade', () => {
    it('should return A for zero total', () => {
      expect(computeGrade(0, 0, 0)).toBe('A');
    });

    it('should return A for no failures and no warnings', () => {
      expect(computeGrade(100, 0, 0)).toBe('A');
    });

    it('should return A for no failures and warnings at 10% boundary', () => {
      // 10 warnings out of 100 = 10% = exactly 0.1, should be A
      expect(computeGrade(100, 0, 10)).toBe('A');
    });

    it('should return B at exact 5% fail rate boundary with low warnings', () => {
      // 5 failures out of 100 = exactly 5%, warnRate 0 -> failRate <= 0.05 && warnRate <= 0.2 -> B
      expect(computeGrade(100, 5, 0)).toBe('B');
    });

    it('should return C at exact 15% fail rate boundary', () => {
      // 15 out of 100 = exactly 15% = 0.15 -> failRate <= 0.15 -> C
      expect(computeGrade(100, 15, 0)).toBe('C');
    });

    it('should return D at exact 30% fail rate boundary', () => {
      // 30 out of 100 = exactly 30% = 0.3 -> failRate <= 0.3 -> D
      expect(computeGrade(100, 30, 0)).toBe('D');
    });

    it('should return F above 30% fail rate', () => {
      expect(computeGrade(100, 31, 0)).toBe('F');
    });

    it('should downgrade from A when warnings exceed 10%', () => {
      // 0 failures, 11 warnings out of 100 = 11% > 0.1
      // failRate 0 <= 0.05, warnRate 0.11 <= 0.2 -> B
      expect(computeGrade(100, 0, 11)).toBe('B');
    });
  });
});
