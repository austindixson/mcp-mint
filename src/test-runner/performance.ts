import type { LatencyStats, TestResult, TestStatus } from '../types/index.js';

export interface LatencyThresholds {
  /** p95 threshold in ms. Warn at 2x, fail at 5x. */
  readonly p95Threshold: number;
}

const DEFAULT_THRESHOLDS: LatencyThresholds = { p95Threshold: 1000 };

export function computeLatencyStats(samples: readonly number[]): LatencyStats {
  if (samples.length === 0) {
    throw new Error('Cannot compute latency stats from empty samples');
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const len = sorted.length;
  const sum = sorted.reduce((acc, v) => acc + v, 0);

  return {
    min: sorted[0]!,
    max: sorted[len - 1]!,
    mean: sum / len,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  };
}

function percentile(sorted: readonly number[], pct: number): number {
  if (sorted.length === 1) return sorted[0]!;
  const idx = (pct / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower]!;
  const weight = idx - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

export function gradeLatency(
  toolName: string,
  stats: LatencyStats,
  thresholds: LatencyThresholds = DEFAULT_THRESHOLDS,
): TestResult {
  const { p95Threshold } = thresholds;
  const warnThreshold = p95Threshold * 2;
  const failThreshold = p95Threshold * 5;

  let status: TestStatus;
  let severity: 'high' | 'medium' | 'info';

  if (stats.p95 >= failThreshold) {
    status = 'fail';
    severity = 'high';
  } else if (stats.p95 >= warnThreshold) {
    status = 'warn';
    severity = 'medium';
  } else {
    status = 'pass';
    severity = 'info';
  }

  return {
    name: `perf.${toolName}.p95`,
    status,
    severity,
    message: `p95=${stats.p95.toFixed(0)}ms, mean=${stats.mean.toFixed(0)}ms (threshold: ${p95Threshold}ms)`,
    durationMs: stats.mean,
  };
}

/**
 * Convenience wrapper that handles empty arrays gracefully.
 * Returns zero-stats for empty input instead of throwing.
 */
export function measurePerformance(samples: readonly number[]): LatencyStats {
  if (samples.length === 0) {
    return { min: 0, max: 0, mean: 0, p50: 0, p95: 0, p99: 0 };
  }
  return computeLatencyStats(samples);
}
