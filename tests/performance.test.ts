import { describe, it, expect } from 'vitest';
import { computeLatencyStats, gradeLatency } from '../src/test-runner/performance.js';
import type { LatencyStats } from '../src/types/index.js';

describe('Performance Benchmarker', () => {
  describe('computeLatencyStats', () => {
    it('should compute correct stats for a simple array', () => {
      const samples = [10, 20, 30, 40, 50];
      const stats = computeLatencyStats(samples);

      expect(stats.min).toBe(10);
      expect(stats.max).toBe(50);
      expect(stats.mean).toBe(30);
      expect(stats.p50).toBe(30);
    });

    it('should compute p95 and p99 correctly', () => {
      // 100 samples from 1 to 100
      const samples = Array.from({ length: 100 }, (_, i) => i + 1);
      const stats = computeLatencyStats(samples);

      expect(stats.min).toBe(1);
      expect(stats.max).toBe(100);
      expect(stats.mean).toBe(50.5);
      expect(stats.p95).toBeGreaterThanOrEqual(95);
      expect(stats.p99).toBeGreaterThanOrEqual(99);
    });

    it('should handle single sample', () => {
      const stats = computeLatencyStats([42]);

      expect(stats.min).toBe(42);
      expect(stats.max).toBe(42);
      expect(stats.mean).toBe(42);
      expect(stats.p50).toBe(42);
      expect(stats.p95).toBe(42);
      expect(stats.p99).toBe(42);
    });

    it('should handle unsorted input', () => {
      const samples = [50, 10, 30, 20, 40];
      const stats = computeLatencyStats(samples);

      expect(stats.min).toBe(10);
      expect(stats.max).toBe(50);
      expect(stats.p50).toBe(30);
    });

    it('should throw on empty array', () => {
      expect(() => computeLatencyStats([])).toThrow();
    });
  });

  describe('gradeLatency', () => {
    it('should grade fast responses as pass', () => {
      const stats: LatencyStats = {
        min: 5, max: 50, mean: 20, p50: 15, p95: 45, p99: 50,
      };
      const result = gradeLatency('fast_tool', stats, { p95Threshold: 1000 });
      expect(result.status).toBe('pass');
    });

    it('should warn on moderate latency', () => {
      const stats: LatencyStats = {
        min: 100, max: 2500, mean: 800, p50: 600, p95: 2200, p99: 2500,
      };
      const result = gradeLatency('slow_tool', stats, { p95Threshold: 1000 });
      expect(result.status).toBe('warn');
    });

    it('should fail on high latency', () => {
      const stats: LatencyStats = {
        min: 1000, max: 15000, mean: 8000, p50: 7000, p95: 12000, p99: 15000,
      };
      const result = gradeLatency('very_slow', stats, { p95Threshold: 1000 });
      expect(result.status).toBe('fail');
    });

    it('should use custom thresholds', () => {
      const stats: LatencyStats = {
        min: 500, max: 3000, mean: 1500, p50: 1200, p95: 2800, p99: 3000,
      };
      const result = gradeLatency('custom', stats, { p95Threshold: 5000 });
      expect(result.status).toBe('pass');
    });
  });
});
