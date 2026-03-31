import { describe, it, expect } from 'vitest';
import { formatResult, formatSuite, formatReport } from '../src/utils/logger.js';
import type { ForgeReport, TestResult, TestSuiteResult } from '../src/types/index.js';

describe('Logger / Formatter', () => {
  describe('formatResult', () => {
    it('should format a passing result', () => {
      const result: TestResult = {
        name: 'test.foo',
        status: 'pass',
        severity: 'info',
        message: 'All good',
      };
      const output = formatResult(result);
      expect(output).toContain('PASS');
      expect(output).toContain('test.foo');
      expect(output).toContain('All good');
    });

    it('should format a failing result', () => {
      const result: TestResult = {
        name: 'test.bar',
        status: 'fail',
        severity: 'critical',
        message: 'Something broke',
      };
      const output = formatResult(result);
      expect(output).toContain('FAIL');
      expect(output).toContain('Something broke');
    });

    it('should include duration when present', () => {
      const result: TestResult = {
        name: 'test.perf',
        status: 'pass',
        severity: 'info',
        message: 'Fast',
        durationMs: 42,
      };
      const output = formatResult(result);
      expect(output).toContain('42');
    });

    it('should format a warning', () => {
      const result: TestResult = {
        name: 'test.warn',
        status: 'warn',
        severity: 'medium',
        message: 'Heads up',
      };
      const output = formatResult(result);
      expect(output).toContain('WARN');
    });

    it('should format a skipped result', () => {
      const result: TestResult = {
        name: 'test.skip',
        status: 'skip',
        severity: 'info',
        message: 'Skipped',
      };
      const output = formatResult(result);
      expect(output).toContain('SKIP');
    });
  });

  describe('formatSuite', () => {
    it('should format a suite with results', () => {
      const suite: TestSuiteResult = {
        suite: 'Schema Validation',
        durationMs: 100,
        results: [
          { name: 'test1', status: 'pass', severity: 'info', message: 'ok' },
          { name: 'test2', status: 'fail', severity: 'high', message: 'bad' },
        ],
      };
      const output = formatSuite(suite);
      expect(output).toContain('Schema Validation');
      expect(output).toContain('100ms');
      expect(output).toContain('PASS');
      expect(output).toContain('FAIL');
    });
  });

  describe('formatReport', () => {
    it('should format a complete report', () => {
      const report: ForgeReport = {
        server: { command: 'node', args: ['server.js'] },
        suites: [
          {
            suite: 'Protocol',
            durationMs: 50,
            results: [
              { name: 'init', status: 'pass', severity: 'info', message: 'ok' },
            ],
          },
        ],
        summary: {
          total: 1,
          passed: 1,
          failed: 0,
          warnings: 0,
          skipped: 0,
          durationMs: 50,
          grade: 'A',
        },
        timestamp: '2026-03-31T00:00:00.000Z',
      };

      const output = formatReport(report);
      expect(output).toContain('MCP Forge Test Report');
      expect(output).toContain('Grade:');
      expect(output).toContain('A');
      expect(output).toContain('1 passed');
      expect(output).toContain('0 failed');
    });

    it('should show failing grade for bad report', () => {
      const report: ForgeReport = {
        server: { command: 'python3', args: ['server.py'] },
        suites: [
          {
            suite: 'Security',
            durationMs: 200,
            results: [
              { name: 's1', status: 'fail', severity: 'critical', message: 'leak' },
              { name: 's2', status: 'fail', severity: 'high', message: 'ssrf' },
            ],
          },
        ],
        summary: {
          total: 2,
          passed: 0,
          failed: 2,
          warnings: 0,
          skipped: 0,
          durationMs: 200,
          grade: 'F',
        },
        timestamp: '2026-03-31T00:00:00.000Z',
      };

      const output = formatReport(report);
      expect(output).toContain('F');
      expect(output).toContain('2 failed');
    });
  });
});
