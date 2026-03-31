// ── MCP Server Configuration ────────────────────────────────────────

export interface McpServerConfig {
  /** Command to start the MCP server (e.g., "node", "python3") */
  readonly command: string;
  /** Arguments passed to the command (e.g., ["server.js"]) */
  readonly args: readonly string[];
  /** Environment variables for the server process */
  readonly env?: Readonly<Record<string, string>>;
  /** Working directory for the server process */
  readonly cwd?: string;
  /** Timeout in ms for server startup (default: 10000) */
  readonly startupTimeout?: number;
}

// ── Test Results ────────────────────────────────────────────────────

export type TestStatus = 'pass' | 'fail' | 'warn' | 'skip';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface TestResult {
  readonly name: string;
  readonly status: TestStatus;
  readonly severity: Severity;
  readonly message: string;
  readonly details?: string;
  readonly durationMs?: number;
}

export interface TestSuiteResult {
  readonly suite: string;
  readonly results: readonly TestResult[];
  readonly durationMs: number;
}

export interface ForgeReport {
  readonly server: McpServerConfig;
  readonly suites: readonly TestSuiteResult[];
  readonly summary: ReportSummary;
  readonly timestamp: string;
}

export interface ReportSummary {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly warnings: number;
  readonly skipped: number;
  readonly durationMs: number;
  readonly grade: Grade;
}

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

// ── Schema Validation ───────────────────────────────────────────────

export interface ToolDefinition {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema?: Record<string, unknown>;
}

export interface SchemaViolation {
  readonly tool: string;
  readonly field: string;
  readonly message: string;
  readonly severity: Severity;
}

// ── Security Scanning ───────────────────────────────────────────────

export type SecurityCategory =
  | 'secrets'
  | 'ssrf'
  | 'injection'
  | 'path_traversal'
  | 'information_disclosure';

export interface SecurityFinding {
  readonly category: SecurityCategory;
  readonly severity: Severity;
  readonly tool: string;
  readonly message: string;
  readonly evidence?: string;
}

// ── Performance Metrics ─────────────────────────────────────────────

export interface PerformanceMetrics {
  readonly tool: string;
  readonly latencyMs: LatencyStats;
  readonly throughputRps?: number;
}

export interface LatencyStats {
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
}

// ── MCP Protocol Types (subset for testing) ─────────────────────────

export interface McpInitializeResult {
  readonly protocolVersion: string;
  readonly capabilities: Record<string, unknown>;
  readonly serverInfo: {
    readonly name: string;
    readonly version: string;
  };
}

export interface McpToolListResult {
  readonly tools: readonly ToolDefinition[];
}

export interface McpToolCallResult {
  readonly content: readonly McpContent[];
  readonly isError?: boolean;
}

export interface McpContent {
  readonly type: string;
  readonly text?: string;
  readonly data?: string;
  readonly mimeType?: string;
}
