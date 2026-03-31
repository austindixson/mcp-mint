/**
 * Meta-validation test suite for mcp-mint
 *
 * This suite tests the testing framework itself - validating that
 * mcp-mint's validation logic is accurate, performant, and reliable.
 *
 * Tests measure:
 * - Validation accuracy (true positives/negatives, false positives/negatives)
 * - Performance characteristics (latency per validation type)
 * - Edge case handling
 * - Error recovery
 */

import { describe, it, expect } from 'vitest';
import { validateToolDefinitions } from '../src/test-runner/schema.js';
import { scanToolDefinition, scanToolResponse } from '../src/test-runner/security.js';
import {
  validateInitializeResult,
  validateToolListResult,
  validateToolCallResult,
} from '../src/test-runner/protocol.js';
import { computeLatencyStats, gradeLatency, measurePerformance } from '../src/test-runner/performance.js';

// Convenience wrapper for grading
function gradePerformance(p95: number, baseline: number) {
  const stats = { min: 0, max: p95 * 2, mean: p95, p50: p95 * 0.9, p95, p99: p95 * 1.1 };
  const result = gradeLatency('test', stats, { p95Threshold: baseline });
  return result.status;
}
import type { ToolDefinition, McpToolCallResult } from '../src/types/index.js';

// =============================================================================
// Test Result Tracking
// =============================================================================

interface MetaTestResult {
  suite: string;
  test: string;
  passed: boolean;
  latencyMs: number;
  category: 'accuracy' | 'performance' | 'edge-case' | 'error-handling';
}

const metaTestResults: MetaTestResult[] = [];

function trackMetaTest(
  suite: string,
  test: string,
  passed: boolean,
  latencyMs: number,
  category: MetaTestResult['category'],
): void {
  metaTestResults.push({ suite, test, passed, latencyMs, category });
}

// =============================================================================
// Schema Validator Tests
// =============================================================================

describe('Meta-Validation: Schema Validator', () => {
  it('should accept valid tool definitions (accuracy)', () => {
    const start = performance.now();
    const validTools: ToolDefinition[] = [
      {
        name: 'search',
        description: 'Search the web for information',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
          },
        },
      },
      {
        name: 'calculate',
        description: 'Perform mathematical calculations',
        inputSchema: {
          type: 'object',
          properties: {
            expression: { type: 'string', description: 'Math expression' },
          },
        },
      },
    ];

    const violations = validateToolDefinitions(validTools);
    const latency = performance.now() - start;

    const passed = violations.length === 0;
    trackMetaTest('schema', 'valid-tools-accepted', passed, latency, 'accuracy');

    expect(passed).toBe(true);
    expect(violations).toEqual([]);
  });

  it('should reject invalid tool names (accuracy)', () => {
    const start = performance.now();
    const invalidTools: ToolDefinition[] = [
      {
        name: 'invalid name with spaces!',
        description: 'This tool name has invalid characters',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ];

    const violations = validateToolDefinitions(invalidTools);
    const latency = performance.now() - start;

    const passed = violations.some((v) => v.field === 'name' && v.severity === 'high');
    trackMetaTest('schema', 'invalid-name-rejected', passed, latency, 'accuracy');

    expect(passed).toBe(true);
  });

  it('should detect duplicate tool names (accuracy)', () => {
    const start = performance.now();
    const duplicateTools: ToolDefinition[] = [
      {
        name: 'duplicate',
        description: 'First occurrence',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'duplicate',
        description: 'Second occurrence',
        inputSchema: { type: 'object', properties: {} },
      },
    ];

    const violations = validateToolDefinitions(duplicateTools);
    const latency = performance.now() - start;

    const passed = violations.some((v) => v.field === 'name' && v.severity === 'critical');
    trackMetaTest('schema', 'duplicate-names-detected', passed, latency, 'accuracy');

    expect(passed).toBe(true);
  });

  it('should warn on short descriptions (accuracy)', () => {
    const start = performance.now();
    const shortDescTools: ToolDefinition[] = [
      {
        name: 'tool',
        description: 'Short',
        inputSchema: { type: 'object', properties: {} },
      },
    ];

    const violations = validateToolDefinitions(shortDescTools);
    const latency = performance.now() - start;

    const passed = violations.some((v) => v.field === 'description' && v.severity === 'low');
    trackMetaTest('schema', 'short-description-warned', passed, latency, 'accuracy');

    expect(passed).toBe(true);
  });

  it('should handle empty tool list (edge-case)', () => {
    const start = performance.now();
    const violations = validateToolDefinitions([]);
    const latency = performance.now() - start;

    const passed = violations.length === 0;
    trackMetaTest('schema', 'empty-tool-list', passed, latency, 'edge-case');

    expect(passed).toBe(true);
  });

  it('should handle missing tool name (edge-case)', () => {
    const start = performance.now();
    const missingNameTools = [
      {
        description: 'Tool without name',
        inputSchema: { type: 'object', properties: {} },
      } as unknown as ToolDefinition,
    ];

    const violations = validateToolDefinitions(missingNameTools);
    const latency = performance.now() - start;

    const passed = violations.some((v) => v.severity === 'critical');
    trackMetaTest('schema', 'missing-name-handled', passed, latency, 'edge-case');

    expect(passed).toBe(true);
  });

  it('should validate large tool sets efficiently (performance)', () => {
    const start = performance.now();
    const largeToolSet: ToolDefinition[] = Array.from({ length: 100 }, (_, i) => ({
      name: `tool_${i}`,
      description: `Tool number ${i} for performance testing`,
      inputSchema: {
        type: 'object',
        properties: {
          param: { type: 'string', description: `Parameter for tool ${i}` },
        },
      },
    }));

    const violations = validateToolDefinitions(largeToolSet);
    const latency = performance.now() - start;

    const passed = violations.length === 0 && latency < 100; // Should be fast
    trackMetaTest('schema', 'large-set-performance', passed, latency, 'performance');

    expect(passed).toBe(true);
    expect(latency).toBeLessThan(100);
  });
});

// =============================================================================
// Security Scanner Tests
// =============================================================================

describe('Meta-Validation: Security Scanner', () => {
  it('should detect AWS access keys (accuracy)', () => {
    const start = performance.now();
    const toolWithSecret: ToolDefinition = {
      name: 'aws_tool',
      description: 'Tool that configures AWS with AKIAIOSFODNN7EXAMPLE key',
      inputSchema: {
        type: 'object',
        properties: {
          api_key: { type: 'string', description: 'AWS access key' },
        },
      },
    };

    const findings = scanToolDefinition(toolWithSecret);
    const latency = performance.now() - start;

    // Should flag the AWS key pattern in description
    const passed = findings.some((f) => f.category === 'secrets' && f.severity === 'critical');
    trackMetaTest('security', 'aws-key-detected', passed, latency, 'accuracy');

    expect(passed).toBe(true);
  });

  it('should detect SSRF patterns (accuracy)', () => {
    const start = performance.now();
    const ssrfTool: ToolDefinition = {
      name: 'fetch',
      description: 'Fetch from URL',
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to fetch',
          },
        },
      },
    };

    const findings = scanToolDefinition(ssrfTool);
    const latency = performance.now() - start;

    // 'url' parameter name should be flagged as SSRF risk
    const passed = findings.some((f) => f.category === 'ssrf');
    trackMetaTest('security', 'ssrf-detected', passed, latency, 'accuracy');

    expect(passed).toBe(true);
  });

  it('should detect command injection (accuracy)', () => {
    const start = performance.now();
    const cmdTool: ToolDefinition = {
      name: 'exec',
      description: 'Execute commands',
      inputSchema: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'System command to execute',
          },
        },
      },
    };

    const findings = scanToolDefinition(cmdTool);
    const latency = performance.now() - start;

    // 'command' parameter name should be flagged as injection risk
    const passed = findings.some((f) => f.category === 'injection');
    trackMetaTest('security', 'command-injection-detected', passed, latency, 'accuracy');

    expect(passed).toBe(true);
  });

  it('should detect secrets in tool responses (accuracy)', () => {
    const start = performance.now();
    const responseWithSecret: McpToolCallResult = {
      content: [
        {
          type: 'text',
          text: 'Configuration: api_key=sk-ant-api123-456-789',
        },
      ],
    };

    const findings = scanToolResponse('config_tool', responseWithSecret);
    const latency = performance.now() - start;

    const passed = findings.some((f) => f.category === 'secrets');
    trackMetaTest('security', 'secret-in-response-detected', passed, latency, 'accuracy');

    expect(passed).toBe(true);
  });

  it('should avoid false positives on safe content (accuracy)', () => {
    const start = performance.now();
    const safeTool: ToolDefinition = {
      name: 'safe_calculator',
      description: 'A simple calculator with no security risks',
      inputSchema: {
        type: 'object',
        properties: {
          a: { type: 'number', description: 'First number' },
          b: { type: 'number', description: 'Second number' },
        },
      },
    };

    const findings = scanToolDefinition(safeTool);
    const latency = performance.now() - start;

    const passed = findings.length === 0;
    trackMetaTest('security', 'no-false-positive', passed, latency, 'accuracy');

    expect(passed).toBe(true);
  });

  it('should handle empty response (edge-case)', () => {
    const start = performance.now();
    const emptyResponse: McpToolCallResult = {
      content: [],
    };

    const findings = scanToolResponse('test', emptyResponse);
    const latency = performance.now() - start;

    const passed = findings.length === 0;
    trackMetaTest('security', 'empty-response-handled', passed, latency, 'edge-case');

    expect(passed).toBe(true);
  });

  it('should scan large responses efficiently (performance)', () => {
    const start = performance.now();
    const largeResponse: McpToolCallResult = {
      content: [
        {
          type: 'text',
          text: 'A'.repeat(100000), // 100KB of safe text
        },
      ],
    };

    const findings = scanToolResponse('large_tool', largeResponse);
    const latency = performance.now() - start;

    const passed = findings.length === 0 && latency < 50;
    trackMetaTest('security', 'large-response-performance', passed, latency, 'performance');

    expect(passed).toBe(true);
    expect(latency).toBeLessThan(50);
  });
});

// =============================================================================
// Protocol Validator Tests
// =============================================================================

describe('Meta-Validation: Protocol Validator', () => {
  it('should validate correct initialize response (accuracy)', () => {
    const start = performance.now();
    const validInit = {
      protocolVersion: '2024-11-05',
      serverInfo: {
        name: 'test-server',
        version: '1.0.0',
      },
      capabilities: {
        tools: {},
      },
    };

    const results = validateInitializeResult(validInit);
    const latency = performance.now() - start;

    const passed = results.every((r) => r.status === 'pass' || r.status === 'info');
    trackMetaTest('protocol', 'valid-init-accepted', passed, latency, 'accuracy');

    expect(passed).toBe(true);
  });

  it('should detect missing protocol version (accuracy)', () => {
    const start = performance.now();
    const invalidInit = {
      serverInfo: { name: 'test' },
    } as any;

    const results = validateInitializeResult(invalidInit);
    const latency = performance.now() - start;

    const passed = results.some((r) => r.status === 'fail' && r.name.includes('protocolVersion'));
    trackMetaTest('protocol', 'missing-protocol-detected', passed, latency, 'accuracy');

    expect(passed).toBe(true);
  });

  it('should validate tool list response (accuracy)', () => {
    const start = performance.now();
    const validToolList = {
      tools: [
        {
          name: 'test_tool',
          description: 'A test tool',
          inputSchema: { type: 'object', properties: {} },
        },
      ],
    };

    const results = validateToolListResult(validToolList);
    const latency = performance.now() - start;

    const passed = results.every((r) => r.status === 'pass' || r.status === 'info');
    trackMetaTest('protocol', 'valid-tool-list-accepted', passed, latency, 'accuracy');

    expect(passed).toBe(true);
  });

  it('should validate tool call response (accuracy)', () => {
    const start = performance.now();
    const validResponse: McpToolCallResult = {
      content: [
        {
          type: 'text',
          text: 'Success',
        },
      ],
    };

    const results = validateToolCallResult(validResponse);
    const latency = performance.now() - start;

    const passed = results.every((r) => r.status === 'pass' || r.status === 'info');
    trackMetaTest('protocol', 'valid-tool-call-accepted', passed, latency, 'accuracy');

    expect(passed).toBe(true);
  });

  it('should handle empty tool list (edge-case)', () => {
    const start = performance.now();
    const emptyToolList = { tools: [] };

    const results = validateToolListResult(emptyToolList);
    const latency = performance.now() - start;

    const passed = results.length > 0; // Should have some validation output
    trackMetaTest('protocol', 'empty-tool-list-handled', passed, latency, 'edge-case');

    expect(passed).toBe(true);
  });
});

// =============================================================================
// Performance Tests
// =============================================================================

describe('Meta-Validation: Performance', () => {
  it('should measure performance accurately (accuracy)', () => {
    const start = performance.now();
    const mockLatencies = [10, 15, 12, 18, 14, 16, 13, 17, 11, 14];

    const metrics = measurePerformance(mockLatencies);
    const latency = performance.now() - start;

    const passed =
      metrics.min === 10 &&
      metrics.max === 18 &&
      Math.abs(metrics.mean - 14) < 0.1 &&
      metrics.p95 > 17 && metrics.p95 < 18; // p95 uses interpolation
    trackMetaTest('performance', 'metrics-accuracy', passed, latency, 'accuracy');

    expect(passed).toBe(true);
  });

  it('should grade performance correctly (accuracy)', () => {
    const start = performance.now();
    const grade = gradePerformance(100, 50); // p95=100, baseline=50
    const latency = performance.now() - start;

    // 100ms is 2x baseline (50ms), so it should warn (not fail)
    const passed = grade === 'warn';
    trackMetaTest('performance', 'grading-correctness', passed, latency, 'accuracy');

    expect(passed).toBe(true);
  });

  it('should handle empty latency array (edge-case)', () => {
    const start = performance.now();
    const metrics = measurePerformance([]);
    const latency = performance.now() - start;

    const passed = metrics.min === 0 && metrics.max === 0 && metrics.mean === 0;
    trackMetaTest('performance', 'empty-latency-handled', passed, latency, 'edge-case');

    expect(passed).toBe(true);
  });
});

// =============================================================================
// Summary Report Generation
// =============================================================================

describe('Meta-Validation: Summary Report', () => {
  it('should generate comprehensive summary', () => {
    const totalTests = metaTestResults.length;
    const passedTests = metaTestResults.filter((r) => r.passed).length;
    const failedTests = totalTests - passedTests;

    const byCategory = metaTestResults.reduce(
      (acc, r) => {
        acc[r.category] = (acc[r.category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const avgLatency =
      metaTestResults.reduce((sum, r) => sum + r.latencyMs, 0) / totalTests;

    const accuracyTests = metaTestResults.filter((r) => r.category === 'accuracy');
    const accuracyRate =
      accuracyTests.filter((r) => r.passed).length / accuracyTests.length;

    const performanceTests = metaTestResults.filter((r) => r.category === 'performance');
    const avgPerfLatency =
      performanceTests.reduce((sum, r) => sum + r.latencyMs, 0) / performanceTests.length;

    console.log('\n=== META-VALIDATION SUMMARY ===');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
    console.log(`Failed: ${failedTests}`);
    console.log(`\nBy Category:`);
    console.log(`  Accuracy: ${byCategory.accuracy || 0} tests`);
    console.log(`  Performance: ${byCategory.performance || 0} tests`);
    console.log(`  Edge Cases: ${byCategory['edge-case'] || 0} tests`);
    console.log(`  Error Handling: ${byCategory['error-handling'] || 0} tests`);
    console.log(`\nMetrics:`);
    console.log(`  Overall Accuracy: ${(accuracyRate * 100).toFixed(1)}%`);
    console.log(`  Avg Test Latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`  Avg Performance Test Latency: ${avgPerfLatency.toFixed(2)}ms`);

    // Overall expectations
    expect(passedTests / totalTests).toBeGreaterThanOrEqual(0.90); // 90% accuracy
    expect(avgLatency).toBeLessThan(50); // Sub-50ms average
    expect(accuracyRate).toBeGreaterThanOrEqual(0.90); // High accuracy
  });
});
