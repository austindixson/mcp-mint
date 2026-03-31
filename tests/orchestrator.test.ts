import { describe, it, expect } from 'vitest';
import { computeSummary, computeGrade, createReport } from '../src/test-runner/index.js';
import type { TestSuiteResult, McpServerConfig } from '../src/types/index.js';

describe('Test Runner Orchestrator', () => {
  describe('computeGrade', () => {
    it('should return A for zero failures and zero warnings', () => {
      expect(computeGrade(10, 0, 0)).toBe('A');
    });

    it('should return A for zero failures with few warnings', () => {
      expect(computeGrade(20, 0, 2)).toBe('A');
    });

    it('should return B for minor fail rate', () => {
      expect(computeGrade(20, 1, 3)).toBe('B');
    });

    it('should return C for moderate fail rate', () => {
      expect(computeGrade(20, 3, 2)).toBe('C');
    });

    it('should return D for high fail rate', () => {
      expect(computeGrade(20, 5, 0)).toBe('D');
    });

    it('should return F for very high fail rate', () => {
      expect(computeGrade(10, 5, 0)).toBe('F');
    });

    it('should return A for empty test suite', () => {
      expect(computeGrade(0, 0, 0)).toBe('A');
    });
  });

  describe('computeSummary', () => {
    it('should aggregate results across suites', () => {
      const suites: TestSuiteResult[] = [
        {
          suite: 'Schema',
          durationMs: 100,
          results: [
            { name: 'test1', status: 'pass', severity: 'info', message: 'ok' },
            { name: 'test2', status: 'fail', severity: 'high', message: 'bad' },
          ],
        },
        {
          suite: 'Security',
          durationMs: 200,
          results: [
            { name: 'test3', status: 'warn', severity: 'medium', message: 'meh' },
            { name: 'test4', status: 'pass', severity: 'info', message: 'ok' },
          ],
        },
      ];

      const summary = computeSummary(suites);

      expect(summary.total).toBe(4);
      expect(summary.passed).toBe(2);
      expect(summary.failed).toBe(1);
      expect(summary.warnings).toBe(1);
      expect(summary.skipped).toBe(0);
      expect(summary.durationMs).toBe(300);
      expect(summary.grade).toBe('D');
    });

    it('should handle empty suites', () => {
      const summary = computeSummary([]);
      expect(summary.total).toBe(0);
      expect(summary.grade).toBe('A');
    });
  });

  describe('createReport', () => {
    it('should create a complete report', () => {
      const server: McpServerConfig = {
        command: 'node',
        args: ['server.js'],
      };

      const suites: TestSuiteResult[] = [
        {
          suite: 'Protocol',
          durationMs: 50,
          results: [
            { name: 'init', status: 'pass', severity: 'info', message: 'ok' },
          ],
        },
      ];

      const report = createReport(server, suites);

      expect(report.server).toBe(server);
      expect(report.suites).toBe(suites);
      expect(report.summary.total).toBe(1);
      expect(report.summary.grade).toBe('A');
      expect(report.timestamp).toBeTruthy();
    });
  });
});
