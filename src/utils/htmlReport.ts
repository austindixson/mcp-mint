import type { ForgeReport, TestSuiteResult, TestResult, Grade } from '../types/index.js';

// ── Grade Color Mapping ─────────────────────────────────────────────

const GRADE_COLORS: Record<Grade, { bg: string; text: string; className: string }> = {
  A: { bg: '#0cce6b', text: '#fff', className: 'grade-a' },
  B: { bg: '#7cc750', text: '#fff', className: 'grade-b' },
  C: { bg: '#ffa400', text: '#fff', className: 'grade-c' },
  D: { bg: '#ff6e00', text: '#fff', className: 'grade-d' },
  F: { bg: '#ff4e42', text: '#fff', className: 'grade-f' },
};

const STATUS_CLASSES: Record<string, string> = {
  pass: 'status-pass',
  fail: 'status-fail',
  warn: 'status-warn',
  skip: 'status-skip',
};

// ── HTML Generation ─────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderTestRow(result: TestResult): string {
  const statusClass = STATUS_CLASSES[result.status] ?? 'status-skip';
  const statusLabel = result.status.toUpperCase();
  const duration = result.durationMs !== undefined ? `${result.durationMs}ms` : '';

  return `
    <div class="test-row">
      <span class="status-badge ${statusClass}">${statusLabel}</span>
      <span class="test-name">${escapeHtml(result.name)}</span>
      <span class="test-message">${escapeHtml(result.message)}</span>
      ${duration ? `<span class="test-duration">${duration}</span>` : ''}
    </div>`;
}

function renderSuite(suite: TestSuiteResult): string {
  const rows = suite.results.map(renderTestRow).join('');
  const passCount = suite.results.filter(r => r.status === 'pass').length;
  const total = suite.results.length;
  const allPassed = passCount === total && total > 0;

  return `
    <details class="suite" ${allPassed ? '' : 'open'}>
      <summary class="suite-header">
        <span class="suite-name">${escapeHtml(suite.suite)}</span>
        <span class="suite-meta">${passCount}/${total} passed &middot; ${suite.durationMs}ms</span>
      </summary>
      <div class="suite-body">
        ${total === 0 ? '<div class="empty-suite">No tests in this suite</div>' : rows}
      </div>
    </details>`;
}

function renderStyles(): string {
  return `
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

      :root {
        --bg: #ffffff;
        --bg-card: #f8f9fa;
        --bg-row-hover: #f1f3f5;
        --text: #212529;
        --text-muted: #6c757d;
        --border: #dee2e6;
        --shadow: rgba(0,0,0,0.08);
      }

      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #1a1a2e;
          --bg-card: #16213e;
          --bg-row-hover: #1a1a3e;
          --text: #e0e0e0;
          --text-muted: #8d99ae;
          --border: #2d3047;
          --shadow: rgba(0,0,0,0.3);
        }
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
        background: var(--bg);
        color: var(--text);
        line-height: 1.6;
        padding: 0;
        margin: 0;
      }

      .container {
        max-width: 960px;
        margin: 0 auto;
        padding: 2rem 1rem;
      }

      /* ── Grade Badge ─────────────────────────────────── */
      .grade-section {
        text-align: center;
        margin-bottom: 2rem;
      }

      .grade-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 120px;
        height: 120px;
        border-radius: 50%;
        font-size: 3.5rem;
        font-weight: 700;
        color: #fff;
        box-shadow: 0 4px 24px var(--shadow);
      }

      .grade-a { background: #0cce6b; }
      .grade-b { background: #7cc750; }
      .grade-c { background: #ffa400; }
      .grade-d { background: #ff6e00; }
      .grade-f { background: #ff4e42; }

      .grade-label {
        display: block;
        margin-top: 0.5rem;
        font-size: 0.875rem;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      /* ── Summary Stats Bar ──────────────────────────── */
      .stats-bar {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        justify-content: center;
        margin-bottom: 2rem;
        padding: 1rem;
        background: var(--bg-card);
        border-radius: 12px;
        box-shadow: 0 2px 8px var(--shadow);
      }

      .stat {
        display: flex;
        flex-direction: column;
        align-items: center;
        min-width: 80px;
        padding: 0.5rem 1rem;
      }

      .stat-value {
        font-size: 1.5rem;
        font-weight: 700;
      }

      .stat-label {
        font-size: 0.75rem;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .stat-passed .stat-value { color: #0cce6b; }
      .stat-failed .stat-value { color: #ff4e42; }
      .stat-warnings .stat-value { color: #ffa400; }
      .stat-skipped .stat-value { color: #6c757d; }

      /* ── Suite Sections ─────────────────────────────── */
      .suite {
        margin-bottom: 1rem;
        border: 1px solid var(--border);
        border-radius: 8px;
        overflow: hidden;
        background: var(--bg-card);
      }

      .suite-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.875rem 1rem;
        cursor: pointer;
        user-select: none;
        font-weight: 600;
        list-style: none;
      }

      .suite-header::-webkit-details-marker { display: none; }

      .suite-header::before {
        content: '\\25B6';
        margin-right: 0.5rem;
        font-size: 0.75rem;
        transition: transform 0.2s;
      }

      details[open] > .suite-header::before {
        transform: rotate(90deg);
      }

      .suite-meta {
        font-size: 0.8rem;
        color: var(--text-muted);
        font-weight: 400;
      }

      .suite-body {
        border-top: 1px solid var(--border);
      }

      /* ── Test Rows ──────────────────────────────────── */
      .test-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.625rem 1rem;
        border-bottom: 1px solid var(--border);
        font-size: 0.875rem;
      }

      .test-row:last-child { border-bottom: none; }
      .test-row:hover { background: var(--bg-row-hover); }

      .status-badge {
        display: inline-block;
        padding: 0.125rem 0.5rem;
        border-radius: 4px;
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #fff;
        flex-shrink: 0;
      }

      .status-pass { background: #0cce6b; }
      .status-fail { background: #ff4e42; }
      .status-warn { background: #ffa400; }
      .status-skip { background: #6c757d; }

      .test-name { font-weight: 500; white-space: nowrap; }
      .test-message { color: var(--text-muted); flex: 1; }
      .test-duration { font-size: 0.75rem; color: var(--text-muted); flex-shrink: 0; }

      .empty-suite {
        padding: 1rem;
        text-align: center;
        color: var(--text-muted);
        font-style: italic;
      }

      /* ── Footer ─────────────────────────────────────── */
      .footer {
        text-align: center;
        padding: 2rem 0 1rem;
        font-size: 0.8rem;
        color: var(--text-muted);
      }

      /* ── Responsive ─────────────────────────────────── */
      @media (max-width: 600px) {
        .container { padding: 1rem 0.5rem; }
        .grade-badge { width: 90px; height: 90px; font-size: 2.5rem; }
        .stats-bar { gap: 0.25rem; }
        .stat { min-width: 60px; padding: 0.375rem 0.5rem; }
        .stat-value { font-size: 1.2rem; }
        .test-row { flex-wrap: wrap; gap: 0.375rem; }
        .test-message { flex-basis: 100%; padding-left: 3.5rem; }
      }
    </style>`;
}

export function generateHtmlReport(report: ForgeReport): string {
  const { summary, suites, timestamp } = report;
  const gradeInfo = GRADE_COLORS[summary.grade];

  const suitesHtml = suites.map(renderSuite).join('');

  const durationFormatted =
    summary.durationMs >= 1000
      ? `${(summary.durationMs / 1000).toFixed(2)}s`
      : `${summary.durationMs}ms`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MCP Mint Report &mdash; Grade ${escapeHtml(summary.grade)}</title>
  ${renderStyles()}
</head>
<body>
  <div class="container">
    <div class="grade-section">
      <div class="grade-badge ${gradeInfo.className}">${escapeHtml(summary.grade)}</div>
      <span class="grade-label">Overall Grade</span>
    </div>

    <div class="stats-bar">
      <div class="stat stat-passed">
        <span class="stat-value">${summary.passed}</span>
        <span class="stat-label">Passed</span>
      </div>
      <div class="stat stat-failed">
        <span class="stat-value">${summary.failed}</span>
        <span class="stat-label">Failed</span>
      </div>
      <div class="stat stat-warnings">
        <span class="stat-value">${summary.warnings}</span>
        <span class="stat-label">Warnings</span>
      </div>
      <div class="stat stat-skipped">
        <span class="stat-value">${summary.skipped}</span>
        <span class="stat-label">Skipped</span>
      </div>
      <div class="stat">
        <span class="stat-value">${durationFormatted}</span>
        <span class="stat-label">Duration</span>
      </div>
    </div>

    ${suitesHtml}

    <div class="footer">
      <p>Generated at ${escapeHtml(timestamp)}</p>
      <p>Generated by mcp-mint</p>
    </div>
  </div>
</body>
</html>`;
}
