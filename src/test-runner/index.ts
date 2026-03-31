import type {
  ForgeReport,
  Grade,
  McpServerConfig,
  ReportSummary,
  TestResult,
  TestSuiteResult,
} from '../types/index.js';

export interface TestRunnerOptions {
  readonly suites?: readonly ('schema' | 'protocol' | 'security' | 'performance')[];
  readonly timeout?: number;
}

export function createReport(
  server: McpServerConfig,
  suites: readonly TestSuiteResult[],
): ForgeReport {
  const summary = computeSummary(suites);
  return {
    server,
    suites,
    summary,
    timestamp: new Date().toISOString(),
  };
}

export function computeSummary(
  suites: readonly TestSuiteResult[],
): ReportSummary {
  const allResults = suites.flatMap((s) => s.results);
  const total = allResults.length;
  const passed = allResults.filter((r) => r.status === 'pass').length;
  const failed = allResults.filter((r) => r.status === 'fail').length;
  const warnings = allResults.filter((r) => r.status === 'warn').length;
  const skipped = allResults.filter((r) => r.status === 'skip').length;
  const durationMs = suites.reduce((sum, s) => sum + s.durationMs, 0);
  const grade = computeGrade(total, failed, warnings);

  return { total, passed, failed, warnings, skipped, durationMs, grade };
}

export function computeGrade(
  total: number,
  failed: number,
  warnings: number,
): Grade {
  if (total === 0) return 'A';

  const failRate = failed / total;
  const warnRate = warnings / total;

  if (failRate === 0 && warnRate === 0) return 'A';
  if (failRate === 0 && warnRate <= 0.1) return 'A';
  if (failRate <= 0.05 && warnRate <= 0.2) return 'B';
  if (failRate <= 0.15) return 'C';
  if (failRate <= 0.3) return 'D';
  return 'F';
}
