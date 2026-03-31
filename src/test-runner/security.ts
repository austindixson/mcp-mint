import type {
  SecurityFinding,
  SecurityCategory,
  Severity,
  McpToolCallResult,
  ToolDefinition,
} from '../types/index.js';

interface SecretPattern {
  readonly name: string;
  readonly pattern: RegExp;
}

export const SECRET_PATTERNS: readonly SecretPattern[] = [
  { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/ },
  { name: 'GitHub Token', pattern: /ghp_[A-Za-z0-9_]{36,}/ },
  { name: 'GitHub OAuth', pattern: /gho_[A-Za-z0-9_]{36,}/ },
  { name: 'Slack Token', pattern: /xox[bpors]-[A-Za-z0-9-]+/ },
  { name: 'Generic API Key', pattern: /(?:api[_-]?key|api[_-]?secret|access[_-]?token)\s*[=:]\s*\S{10,}/i },
  { name: 'Private Key', pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/ },
  { name: 'Anthropic Key', pattern: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: 'OpenAI Key', pattern: /sk-[A-Za-z0-9]{20,}/ },
];

const SSRF_PATTERNS: readonly { readonly name: string; readonly pattern: RegExp; readonly severity: Severity }[] = [
  { name: 'AWS Metadata endpoint', pattern: /169\.254\.169\.254/, severity: 'critical' },
  { name: 'Internal IP (10.x)', pattern: /https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}/, severity: 'high' },
  { name: 'Internal IP (192.168.x)', pattern: /https?:\/\/192\.168\.\d{1,3}\.\d{1,3}/, severity: 'high' },
  { name: 'Internal IP (172.16-31.x)', pattern: /https?:\/\/172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}/, severity: 'high' },
  { name: 'Localhost', pattern: /https?:\/\/(?:localhost|127\.0\.0\.1)/, severity: 'medium' },
];

const PATH_TRAVERSAL_PATTERN = /(?:\.\.\/){2,}|\.\.\\(?:\.\.\\)+/;

function finding(
  category: SecurityCategory,
  severity: Severity,
  tool: string,
  message: string,
  evidence?: string,
): SecurityFinding {
  return { category, severity, tool, message, ...(evidence ? { evidence } : {}) };
}

export function scanToolResponse(
  toolName: string,
  response: McpToolCallResult,
): readonly SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  for (const content of response.content) {
    const text = content.text ?? content.data ?? '';
    if (!text) continue;

    // Secrets
    for (const secret of SECRET_PATTERNS) {
      if (secret.pattern.test(text)) {
        findings.push(
          finding(
            'secrets',
            'critical',
            toolName,
            `Possible ${secret.name} detected in response`,
            text.slice(0, 200),
          ),
        );
      }
    }

    // SSRF
    for (const ssrf of SSRF_PATTERNS) {
      if (ssrf.pattern.test(text)) {
        findings.push(
          finding(
            'ssrf',
            ssrf.severity,
            toolName,
            `${ssrf.name} reference detected in response`,
            text.slice(0, 200),
          ),
        );
      }
    }

    // Path traversal
    if (PATH_TRAVERSAL_PATTERN.test(text)) {
      findings.push(
        finding(
          'path_traversal',
          'high',
          toolName,
          'Path traversal pattern detected in response',
          text.slice(0, 200),
        ),
      );
    }
  }

  return findings;
}

const URL_PARAM_NAMES = new Set(['url', 'uri', 'endpoint', 'href', 'link', 'webhook', 'callback']);
const PATH_PARAM_NAMES = new Set(['path', 'file', 'filepath', 'file_path', 'filename', 'directory', 'dir', 'folder']);
const COMMAND_PARAM_NAMES = new Set(['command', 'cmd', 'shell', 'exec', 'script', 'query', 'sql']);

export function scanToolDefinition(
  tool: ToolDefinition,
): readonly SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const schema = tool.inputSchema;

  if (!schema) return findings;

  const properties = (schema as Record<string, unknown>).properties;
  if (!properties || typeof properties !== 'object') return findings;

  for (const [paramName, paramDef] of Object.entries(properties as Record<string, Record<string, unknown>>)) {
    const lowerName = paramName.toLowerCase();
    const paramType = paramDef?.type;

    if (paramType !== 'string') continue;

    if (URL_PARAM_NAMES.has(lowerName)) {
      findings.push(
        finding(
          'ssrf',
          'medium',
          tool.name,
          `Parameter "${paramName}" accepts URLs — ensure server-side validation prevents SSRF`,
        ),
      );
    }

    if (PATH_PARAM_NAMES.has(lowerName)) {
      findings.push(
        finding(
          'path_traversal',
          'medium',
          tool.name,
          `Parameter "${paramName}" accepts file paths — ensure path traversal is prevented`,
        ),
      );
    }

    if (COMMAND_PARAM_NAMES.has(lowerName)) {
      findings.push(
        finding(
          'injection',
          'high',
          tool.name,
          `Parameter "${paramName}" accepts commands — high risk of command injection`,
        ),
      );
    }
  }

  return findings;
}
