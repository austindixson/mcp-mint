import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateToolDefinitions } from './test-runner/schema.js';
import { scanToolDefinition } from './test-runner/security.js';
import { createReport } from './test-runner/index.js';
import type {
  ToolDefinition,
  TestResult,
  TestSuiteResult,
  McpServerConfig,
  ForgeReport,
} from './types/index.js';

export interface ManifestFile {
  readonly name: string;
  readonly version: string;
  readonly tools: readonly ToolDefinition[];
}

export function loadManifest(filePath: string): ManifestFile {
  const abs = resolve(filePath);
  const raw = readFileSync(abs, 'utf-8');
  const parsed = JSON.parse(raw) as Record<string, unknown>;

  if (!parsed.name || typeof parsed.name !== 'string') {
    throw new Error('Manifest missing required "name" field');
  }
  if (!parsed.tools || !Array.isArray(parsed.tools)) {
    throw new Error('Manifest missing required "tools" array');
  }

  return {
    name: parsed.name as string,
    version: (parsed.version as string) ?? '0.0.0',
    tools: parsed.tools as ToolDefinition[],
  };
}

export function validateManifest(manifest: ManifestFile): ForgeReport {
  const suites: TestSuiteResult[] = [];

  // Schema suite
  const schemaStart = Date.now();
  const schemaResults: TestResult[] = [];
  const violations = validateToolDefinitions(manifest.tools);

  if (violations.length === 0) {
    schemaResults.push({
      name: 'schema.tools',
      status: 'pass',
      severity: 'info',
      message: `All ${manifest.tools.length} tool(s) have valid schemas`,
    });
  } else {
    for (const v of violations) {
      schemaResults.push({
        name: `schema.${v.tool}.${v.field}`,
        status: v.severity === 'critical' || v.severity === 'high' ? 'fail' : 'warn',
        severity: v.severity,
        message: v.message,
      });
    }
  }
  suites.push({ suite: 'Schema Validation', results: schemaResults, durationMs: Date.now() - schemaStart });

  // Security suite
  const secStart = Date.now();
  const secResults: TestResult[] = [];

  for (const tool of manifest.tools) {
    const findings = scanToolDefinition(tool);
    if (findings.length === 0) {
      secResults.push({
        name: `security.${tool.name}.definition`,
        status: 'pass',
        severity: 'info',
        message: 'No security concerns in tool definition',
      });
    } else {
      for (const f of findings) {
        secResults.push({
          name: `security.${f.tool}.${f.category}`,
          status: f.severity === 'critical' || f.severity === 'high' ? 'fail' : 'warn',
          severity: f.severity,
          message: f.message,
        });
      }
    }
  }
  suites.push({ suite: 'Security Scan', results: secResults, durationMs: Date.now() - secStart });

  const server: McpServerConfig = {
    command: 'validate',
    args: [manifest.name],
  };

  return createReport(server, suites);
}
