import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { ToolDefinition } from '../src/types/index.js';

interface TestResult {
  iteration: number;
  tool: string;
  success: boolean;
  latencyMs: number;
  error?: string;
}

interface IterationReport {
  iteration: number;
  results: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    successRate: number;
    avgLatencyMs: number;
    issues: string[];
  };
}

const BROWSER_TEST_URLS = [
  'https://example.com',
  'https://httpbin.org/html',
  'https://github.com',
];

describe('E2E: Browser MCP Server', () => {
  let client: Client;
  let transport: StdioClientTransport;

  async function connect(): Promise<void> {
    transport = new StdioClientTransport({
      command: 'npx',
      args: ['tsx', 'examples/browser-server.ts'],
      cwd: process.env.PROJECT_ROOT || process.cwd(),
    });

    client = new Client(
      { name: 'mcp-mint-e2e', version: '0.1.0' },
      { capabilities: {} },
    );

    await client.connect(transport);
  }

  async function disconnect(): Promise<void> {
    try {
      await client?.close();
    } catch {
      // server may already be closed
    }
  }

  async function runTestIteration(iteration: number): Promise<IterationReport> {
    const results: TestResult[] = [];
    const issues: string[] = [];

    await connect();
    try {
      // Test 1: List tools
      const startTime = Date.now();
      try {
        const toolList = await client.listTools();
        const tools = toolList.tools as unknown as ToolDefinition[];
        results.push({
          iteration,
          tool: 'listTools',
          success: true,
          latencyMs: Date.now() - startTime,
        });

        if (tools.length !== 7) {
          issues.push(`Expected 7 tools, got ${tools.length}`);
        }

        const toolNames = tools.map((t) => t.name);
        const expectedTools = ['navigate', 'screenshot', 'extract_text', 'click', 'evaluate', 'get_links', 'health'];
        for (const expected of expectedTools) {
          if (!toolNames.includes(expected)) {
            issues.push(`Missing tool: ${expected}`);
          }
        }
      } catch (error) {
        results.push({
          iteration,
          tool: 'listTools',
          success: false,
          latencyMs: Date.now() - startTime,
          error: String(error),
        });
        issues.push(`listTools failed: ${error}`);
      }

      // Test 2: Health check (new tool)
      const healthStart = Date.now();
      try {
        const healthResult = await client.callTool({
          name: 'health',
          arguments: {},
        });

        if (healthResult.isError) {
          throw new Error('Health check failed');
        }

        const content = healthResult.content as Array<{ type: string; text: string }>;
        const healthData = JSON.parse(content[0]?.text || '{}');

        if (healthData.status !== 'healthy') {
          issues.push(`Health status: ${healthData.status}`);
        }

        results.push({
          iteration,
          tool: 'health',
          success: true,
          latencyMs: Date.now() - healthStart,
        });
      } catch (error) {
        results.push({
          iteration,
          tool: 'health',
          success: false,
          latencyMs: Date.now() - healthStart,
          error: String(error),
        });
        issues.push(`health check failed: ${error}`);
      }

      // Test 3: Navigate to page
      const testUrl = BROWSER_TEST_URLS[iteration % BROWSER_TEST_URLS.length];
      const navStart = Date.now();
      try {
        const navResult = await client.callTool({
          name: 'navigate',
          arguments: { url: testUrl },
        });
        const content = navResult.content as Array<{ type: string; text: string }>;

        if (navResult.isError) {
          throw new Error(content[0]?.text || 'Navigation failed');
        }

        const navData = JSON.parse(content[0]?.text || '{}');
        results.push({
          iteration,
          tool: 'navigate',
          success: true,
          latencyMs: Date.now() - navStart,
        });

        if (navData.statusCode && navData.statusCode >= 400) {
          issues.push(`Navigation returned status ${navData.statusCode}`);
        }
      } catch (error) {
        results.push({
          iteration,
          tool: 'navigate',
          success: false,
          latencyMs: Date.now() - navStart,
          error: String(error),
        });
        issues.push(`navigate failed: ${error}`);
      }

      // Test 4: Extract text
      const extractStart = Date.now();
      try {
        const extractResult = await client.callTool({
          name: 'extract_text',
          arguments: {},
        });

        if (extractResult.isError) {
          throw new Error('Text extraction failed');
        }

        const content = extractResult.content as Array<{ type: string; text: string }>;
        if (!content[0]?.text || content[0].text.length < 10) {
          issues.push('Extracted text seems too short');
        }

        results.push({
          iteration,
          tool: 'extract_text',
          success: true,
          latencyMs: Date.now() - extractStart,
        });
      } catch (error) {
        results.push({
          iteration,
          tool: 'extract_text',
          success: false,
          latencyMs: Date.now() - extractStart,
          error: String(error),
        });
        issues.push(`extract_text failed: ${error}`);
      }

      // Test 5: Get links
      const linksStart = Date.now();
      try {
        const linksResult = await client.callTool({
          name: 'get_links',
          arguments: {},
        });

        if (linksResult.isError) {
          throw new Error('Get links failed');
        }

        const content = linksResult.content as Array<{ type: string; text: string }>;
        const linkData = JSON.parse(content[0]?.text || '{}');

        // Handle both old format (array) and new format (object with count/links)
        const links = Array.isArray(linkData) ? linkData : linkData.links || [];
        const count = Array.isArray(linkData) ? links.length : (linkData.count || 0);

        // No longer an issue - pages with no links return structured info
        if (count === 0) {
          // Not an error, just a simple page
        }

        results.push({
          iteration,
          tool: 'get_links',
          success: true,
          latencyMs: Date.now() - linksStart,
        });
      } catch (error) {
        results.push({
          iteration,
          tool: 'get_links',
          success: false,
          latencyMs: Date.now() - linksStart,
          error: String(error),
        });
        issues.push(`get_links failed: ${error}`);
      }

      // Test 6: Screenshot
      const shotStart = Date.now();
      try {
        const shotResult = await client.callTool({
          name: 'screenshot',
          arguments: { fullPage: false },
        });

        if (shotResult.isError) {
          throw new Error('Screenshot failed');
        }

        const content = shotResult.content as Array<{ type: string; text: string }>;
        const base64 = content[0]?.text || '';

        // Basic validation - base64 screenshot should be substantial
        if (base64.length < 1000) {
          issues.push('Screenshot data seems too small');
        }

        results.push({
          iteration,
          tool: 'screenshot',
          success: true,
          latencyMs: Date.now() - shotStart,
        });
      } catch (error) {
        results.push({
          iteration,
          tool: 'screenshot',
          success: false,
          latencyMs: Date.now() - shotStart,
          error: String(error),
        });
        issues.push(`screenshot failed: ${error}`);
      }

      // Test 7: Evaluate JavaScript
      const evalStart = Date.now();
      try {
        const evalResult = await client.callTool({
          name: 'evaluate',
          arguments: { script: 'document.title' },
        });

        if (evalResult.isError) {
          throw new Error('Evaluate failed');
        }

        const content = evalResult.content as Array<{ type: string; text: string }>;
        // Empty string or undefined is valid for some expressions
        const text = content[0]?.text;
        if (text === undefined) {
          issues.push('Evaluate returned undefined result');
        }

        results.push({
          iteration,
          tool: 'evaluate',
          success: true,
          latencyMs: Date.now() - evalStart,
        });
      } catch (error) {
        results.push({
          iteration,
          tool: 'evaluate',
          success: false,
          latencyMs: Date.now() - evalStart,
          error: String(error),
        });
        issues.push(`evaluate failed: ${error}`);
      }

    } finally {
      await disconnect();
    }

    const passed = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const avgLatency = results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length;

    return {
      iteration,
      results,
      summary: {
        total: results.length,
        passed,
        failed,
        successRate: (passed / results.length) * 100,
        avgLatencyMs: avgLatency,
        issues,
      },
    };
  }

  // Run 10 iterations
  const allReports: IterationReport[] = [];

  for (let i = 1; i <= 10; i++) {
    it(`iteration ${i}: run full E2E test suite`, async () => {
      const report = await runTestIteration(i);
      allReports.push(report);

      console.log(`\n=== Iteration ${i} Report ===`);
      console.log(`Success Rate: ${report.summary.successRate.toFixed(1)}%`);
      console.log(`Passed: ${report.summary.passed}/${report.summary.total}`);
      console.log(`Avg Latency: ${report.summary.avgLatencyMs.toFixed(0)}ms`);

      if (report.summary.issues.length > 0) {
        console.log(`Issues found:`);
        for (const issue of report.summary.issues) {
          console.log(`  - ${issue}`);
        }
      }

      // Expect at least 80% success rate
      expect(report.summary.successRate).toBeGreaterThanOrEqual(80);
    }, 30000);
  }

  // Final summary test
  it('generate final E2E summary report', async () => {
    console.log('\n\n=== FINAL E2E SUMMARY REPORT ===');
    console.log(`Total iterations: ${allReports.length}`);
    console.log(`\nPer-iteration breakdown:`);

    let totalPassed = 0;
    let totalTests = 0;

    for (const report of allReports) {
      totalPassed += report.summary.passed;
      totalTests += report.summary.total;
      console.log(
        `  Iteration ${report.iteration}: ${report.summary.successRate.toFixed(1)}% (${report.summary.passed}/${report.summary.total}) - ${report.summary.avgLatencyMs.toFixed(0)}ms avg`,
      );
    }

    const overallSuccessRate = (totalPassed / totalTests) * 100;
    console.log(`\nOverall Success Rate: ${overallSuccessRate.toFixed(1)}%`);
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Total Passed: ${totalPassed}`);
    console.log(`Total Failed: ${totalTests - totalPassed}`);

    // Collect all unique issues
    const allIssues = new Set<string>();
    for (const report of allReports) {
      for (const issue of report.summary.issues) {
        allIssues.add(issue);
      }
    }

    if (allIssues.size > 0) {
      console.log(`\nUnique Issues Across All Iterations:`);
      for (const issue of allIssues) {
        console.log(`  - ${issue}`);
      }
    }

    // Analyze trends
    const firstHalf = allReports.slice(0, 5);
    const secondHalf = allReports.slice(5);

    const firstHalfAvgSuccess =
      firstHalf.reduce((sum, r) => sum + r.summary.successRate, 0) / firstHalf.length;
    const secondHalfAvgSuccess =
      secondHalf.reduce((sum, r) => sum + r.summary.successRate, 0) / secondHalf.length;

    console.log(`\nTrend Analysis:`);
    console.log(`  First 5 iterations avg success: ${firstHalfAvgSuccess.toFixed(1)}%`);
    console.log(`  Last 5 iterations avg success: ${secondHalfAvgSuccess.toFixed(1)}%`);

    const improvement = secondHalfAvgSuccess - firstHalfAvgSuccess;
    if (improvement > 0) {
      console.log(`  Improvement: +${improvement.toFixed(1)}%`);
    } else if (improvement < 0) {
      console.log(`  Regression: ${improvement.toFixed(1)}%`);
    } else {
      console.log(`  No change in success rate`);
    }

    // Expect overall success rate to be good
    expect(overallSuccessRate).toBeGreaterThanOrEqual(85);

    // Expect stability (no significant regression)
    expect(improvement).toBeGreaterThan(-10);
  });
});
