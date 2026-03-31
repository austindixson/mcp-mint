import chalk from 'chalk';
import type { ForgeReport, TestResult, TestSuiteResult, Grade } from '../types/index.js';

const STATUS_ICONS: Record<string, string> = {
  pass: chalk.green('PASS'),
  fail: chalk.red('FAIL'),
  warn: chalk.yellow('WARN'),
  skip: chalk.gray('SKIP'),
};

const GRADE_COLORS: Record<Grade, (s: string) => string> = {
  A: chalk.green,
  B: chalk.greenBright,
  C: chalk.yellow,
  D: chalk.red,
  F: chalk.bgRed.white,
};

export function formatResult(result: TestResult): string {
  const icon = STATUS_ICONS[result.status] ?? result.status;
  const duration = result.durationMs != null ? chalk.gray(` (${result.durationMs.toFixed(0)}ms)`) : '';
  return `  ${icon}  ${result.name}: ${result.message}${duration}`;
}

export function formatSuite(suite: TestSuiteResult): string {
  const lines: string[] = [];
  lines.push(chalk.bold.underline(`\n${suite.suite}`) + chalk.gray(` (${suite.durationMs}ms)`));
  for (const result of suite.results) {
    lines.push(formatResult(result));
  }
  return lines.join('\n');
}

export function formatReport(report: ForgeReport): string {
  const lines: string[] = [];

  lines.push(chalk.bold('\nMCP Forge Test Report'));
  lines.push(chalk.gray('─'.repeat(50)));

  for (const suite of report.suites) {
    lines.push(formatSuite(suite));
  }

  const { summary } = report;
  const gradeColor = GRADE_COLORS[summary.grade];

  lines.push(chalk.gray('\n─'.repeat(50)));
  lines.push(chalk.bold('Summary'));
  lines.push(`  Grade: ${gradeColor(summary.grade)}`);
  lines.push(`  Total: ${summary.total} | ${chalk.green(`${summary.passed} passed`)} | ${chalk.red(`${summary.failed} failed`)} | ${chalk.yellow(`${summary.warnings} warnings`)} | ${chalk.gray(`${summary.skipped} skipped`)}`);
  lines.push(`  Duration: ${summary.durationMs}ms`);
  lines.push(`  Timestamp: ${report.timestamp}`);

  return lines.join('\n');
}
