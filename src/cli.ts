import { Command } from 'commander';
import chalk from 'chalk';
import { createReport, computeSummary } from './test-runner/index.js';
import { validateToolDefinitions } from './test-runner/schema.js';
import {
  validateInitializeResult,
  validateToolListResult,
  validateToolCallResult,
} from './test-runner/protocol.js';
import { scanToolResponse, scanToolDefinition } from './test-runner/security.js';
import { computeLatencyStats, gradeLatency } from './test-runner/performance.js';
import { formatReport } from './utils/logger.js';
import type { McpServerConfig, TestSuiteResult, TestResult } from './types/index.js';

export function createCli(): Command {
  const program = new Command();

  program
    .name('mcp-mint')
    .description('Build, test, and publish MCP servers')
    .version('0.1.0');

  program
    .command('test')
    .description('Test an MCP server for compliance, security, and performance')
    .argument('<command>', 'Command to start the MCP server')
    .argument('[args...]', 'Arguments for the server command')
    .option('--timeout <ms>', 'Startup timeout in ms', '10000')
    .option('--suite <suites>', 'Comma-separated suites: schema,protocol,security,performance', 'schema,protocol,security,performance')
    .option('--json', 'Output results as JSON')
    .option('--html <file>', 'Write HTML report to file (like Lighthouse)')
    .action(async (command: string, args: string[], options) => {
      const config: McpServerConfig = {
        command,
        args,
        startupTimeout: parseInt(options.timeout, 10),
      };

      const suites = options.suite.split(',') as string[];

      try {
        const results = await runTests(config, suites);
        const report = createReport(config, results);

        if (options.json) {
          console.log(JSON.stringify(report, null, 2));
        } else {
          console.log(formatReport(report));
        }

        if (options.html) {
          const { generateHtmlReport } = await import('./utils/htmlReport.js');
          const { writeFileSync } = await import('node:fs');
          writeFileSync(options.html, generateHtmlReport(report), 'utf-8');
          console.log(chalk.green(`\nHTML report written to ${options.html}`));
        }

        const exitCode = report.summary.failed > 0 ? 1 : 0;
        process.exit(exitCode);
      } catch (err) {
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
        process.exit(2);
      }
    });

  program
    .command('init')
    .description('Scaffold a new MCP server from a template')
    .argument('[name]', 'Project name', 'my-mcp-server')
    .option('--template <type>', 'Template: rest-api, database, filesystem', 'rest-api')
    .action(async (name: string, options) => {
      console.log(chalk.bold(`Scaffolding MCP server: ${name}`));
      console.log(chalk.gray(`Template: ${options.template}`));
      // Template scaffolding implemented in init module
      const { scaffold } = await import('./init/index.js');
      await scaffold(name, options.template);
    });

  program
    .command('validate')
    .description('Validate an MCP server manifest file offline (no running server needed)')
    .argument('<manifest>', 'Path to manifest JSON file with name, version, and tools array')
    .option('--json', 'Output results as JSON')
    .action(async (manifestPath: string, options) => {
      try {
        const { loadManifest, validateManifest } = await import('./validate.js');
        const manifest = loadManifest(manifestPath);
        const report = validateManifest(manifest);

        if (options.json) {
          console.log(JSON.stringify(report, null, 2));
        } else {
          console.log(formatReport(report));
        }

        const exitCode = report.summary.failed > 0 ? 1 : 0;
        process.exit(exitCode);
      } catch (err) {
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
        process.exit(2);
      }
    });

  program
    .command('doctor')
    .description('Diagnose common MCP server issues')
    .argument('<command>', 'Command to start the MCP server')
    .argument('[args...]', 'Arguments for the server command')
    .action(async (command: string, args: string[]) => {
      try {
        const { diagnose } = await import('./doctor.js');
        const config: McpServerConfig = { command, args };
        console.log(chalk.bold('\nMCP Mint Doctor\n'));
        const results = await diagnose(config);
        for (const r of results) {
          const icon = r.status === 'pass' ? chalk.green('PASS') : r.status === 'fail' ? chalk.red('FAIL') : chalk.yellow('WARN');
          console.log(`  ${icon}  ${r.name}: ${r.message}`);
        }
        const failed = results.filter((r) => r.status === 'fail').length;
        console.log(failed > 0 ? chalk.red(`\n${failed} issue(s) found.`) : chalk.green('\nAll checks passed.'));
        process.exit(failed > 0 ? 1 : 0);
      } catch (err) {
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
        process.exit(2);
      }
    });

  program
    .command('ci')
    .description('Add GitHub Actions workflow for MCP server testing')
    .argument('<command>', 'Command to start the MCP server')
    .argument('[args...]', 'Arguments for the server command')
    .option('--dir <path>', 'Project directory', '.')
    .action(async (command: string, args: string[], options) => {
      try {
        const { writeCiWorkflow } = await import('./ci.js');
        writeCiWorkflow(options.dir, command, args);
        console.log(chalk.green('CI workflow created at .github/workflows/mcp-mint.yml'));
      } catch (err) {
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
        process.exit(2);
      }
    });

  return program;
}

async function runTests(
  config: McpServerConfig,
  suites: readonly string[],
): Promise<readonly TestSuiteResult[]> {
  const results: TestSuiteResult[] = [];

  // For now, run offline validation (no live server needed for schema/security checks)
  // Live server testing will connect via MCP SDK in Phase 2
  console.log(chalk.bold(`\nTesting MCP server: ${config.command} ${config.args.join(' ')}`));
  console.log(chalk.gray('Starting server...\n'));

  let client: McpClientWrapper | null = null;

  try {
    client = await connectToServer(config);

    if (suites.includes('protocol')) {
      results.push(await runProtocolSuite(client));
    }

    if (suites.includes('schema')) {
      results.push(await runSchemaSuite(client));
    }

    if (suites.includes('security')) {
      results.push(await runSecuritySuite(client));
    }

    if (suites.includes('performance')) {
      results.push(await runPerformanceSuite(client));
    }
  } finally {
    if (client) {
      await client.close();
    }
  }

  return results;
}

// ── MCP Client Wrapper ──────────────────────────────────────────────

interface McpClientWrapper {
  initialize(): Promise<Record<string, unknown>>;
  listTools(): Promise<{ tools: readonly Record<string, unknown>[] }>;
  callTool(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>>;
  close(): Promise<void>;
}

async function connectToServer(config: McpServerConfig): Promise<McpClientWrapper> {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');

  const transport = new StdioClientTransport({
    command: config.command,
    args: [...config.args],
    env: config.env as Record<string, string> | undefined,
    cwd: config.cwd,
  });

  const client = new Client(
    { name: 'mcp-mint', version: '0.1.0' },
    { capabilities: {} },
  );

  await client.connect(transport);

  return {
    async initialize() {
      return client.getServerVersion() as unknown as Record<string, unknown>;
    },
    async listTools() {
      const result = await client.listTools();
      return result as unknown as { tools: readonly Record<string, unknown>[] };
    },
    async callTool(name: string, args: Record<string, unknown>) {
      const result = await client.callTool({ name, arguments: args });
      return result as unknown as Record<string, unknown>;
    },
    async close() {
      await client.close();
    },
  };
}

// ── Suite Runners ───────────────────────────────────────────────────

async function runProtocolSuite(client: McpClientWrapper): Promise<TestSuiteResult> {
  const start = Date.now();
  const results: TestResult[] = [];

  try {
    const initResult = await client.initialize();
    results.push(...validateInitializeResult(initResult as any));
  } catch (err) {
    results.push({
      name: 'protocol.initialize',
      status: 'fail',
      severity: 'critical',
      message: `Initialize failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  try {
    const toolList = await client.listTools();
    results.push(...validateToolListResult(toolList as any));
  } catch (err) {
    results.push({
      name: 'protocol.tools/list',
      status: 'fail',
      severity: 'critical',
      message: `tools/list failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  return { suite: 'Protocol Compliance', results, durationMs: Date.now() - start };
}

async function runSchemaSuite(client: McpClientWrapper): Promise<TestSuiteResult> {
  const start = Date.now();
  const results: TestResult[] = [];

  try {
    const { tools } = await client.listTools();
    const violations = validateToolDefinitions(tools as any);

    if (violations.length === 0) {
      results.push({
        name: 'schema.tools',
        status: 'pass',
        severity: 'info',
        message: `All ${tools.length} tool(s) have valid schemas`,
      });
    } else {
      for (const v of violations) {
        results.push({
          name: `schema.${v.tool}.${v.field}`,
          status: v.severity === 'critical' || v.severity === 'high' ? 'fail' : 'warn',
          severity: v.severity,
          message: v.message,
        });
      }
    }
  } catch (err) {
    results.push({
      name: 'schema.tools',
      status: 'fail',
      severity: 'critical',
      message: `Schema check failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  return { suite: 'Schema Validation', results, durationMs: Date.now() - start };
}

async function runSecuritySuite(client: McpClientWrapper): Promise<TestSuiteResult> {
  const start = Date.now();
  const results: TestResult[] = [];

  try {
    const { tools } = await client.listTools();

    // Static analysis of tool definitions
    for (const tool of tools) {
      const findings = scanToolDefinition(tool as any);
      if (findings.length === 0) {
        results.push({
          name: `security.${(tool as any).name}.definition`,
          status: 'pass',
          severity: 'info',
          message: 'No security concerns in tool definition',
        });
      } else {
        for (const f of findings) {
          results.push({
            name: `security.${f.tool}.${f.category}`,
            status: f.severity === 'critical' || f.severity === 'high' ? 'fail' : 'warn',
            severity: f.severity,
            message: f.message,
          });
        }
      }
    }
  } catch (err) {
    results.push({
      name: 'security.scan',
      status: 'fail',
      severity: 'critical',
      message: `Security scan failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  return { suite: 'Security Scan', results, durationMs: Date.now() - start };
}

const PERF_ITERATIONS = 5;

async function runPerformanceSuite(client: McpClientWrapper): Promise<TestSuiteResult> {
  const start = Date.now();
  const results: TestResult[] = [];

  try {
    const { tools } = await client.listTools();

    if (tools.length === 0) {
      results.push({
        name: 'perf.tools',
        status: 'skip',
        severity: 'info',
        message: 'No tools to benchmark',
      });
      return { suite: 'Performance', results, durationMs: Date.now() - start };
    }

    // Benchmark each tool with empty/minimal args
    for (const tool of tools) {
      const toolName = (tool as Record<string, unknown>).name as string;
      const samples: number[] = [];

      for (let i = 0; i < PERF_ITERATIONS; i++) {
        const t0 = performance.now();
        try {
          await client.callTool(toolName, {});
        } catch {
          // Tool may error with empty args — that's fine, we're measuring latency
        }
        samples.push(performance.now() - t0);
      }

      const stats = computeLatencyStats(samples);
      results.push(gradeLatency(toolName, stats));
    }
  } catch (err) {
    results.push({
      name: 'perf.benchmark',
      status: 'fail',
      severity: 'high',
      message: `Performance benchmark failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  return { suite: 'Performance', results, durationMs: Date.now() - start };
}
