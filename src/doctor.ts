/**
 * mcp-mint doctor — diagnose MCP server configuration issues.
 *
 * Runs a series of checks against a server config and returns
 * a readonly array of TestResult (never throws).
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { McpServerConfig, TestResult } from './types/index.js';

// ── Individual checks ──────────────────────────────────────────────

function checkCommandExists(config: McpServerConfig): TestResult {
  const start = Date.now();
  try {
    execFileSync('which', [config.command], { stdio: 'pipe' });
    return {
      name: 'command-exists',
      status: 'pass',
      severity: 'critical',
      message: `Command "${config.command}" found on PATH.`,
      durationMs: Date.now() - start,
    };
  } catch {
    return {
      name: 'command-exists',
      status: 'fail',
      severity: 'critical',
      message: `Command "${config.command}" not found on PATH.`,
      details: `Install "${config.command}" or update your PATH so the server can be started.`,
      durationMs: Date.now() - start,
    };
  }
}

function checkNodeVersion(config: McpServerConfig): TestResult | null {
  const cmd = config.command;
  if (cmd !== 'node' && cmd !== 'npx') return null;

  const start = Date.now();
  try {
    const raw = execFileSync('node', ['--version'], { stdio: 'pipe', encoding: 'utf-8' }).trim();
    const major = Number(raw.replace(/^v/, '').split('.')[0]);
    if (major >= 18) {
      return {
        name: 'node-version',
        status: 'pass',
        severity: 'high',
        message: `Node.js ${raw} meets minimum version requirement (>=18).`,
        durationMs: Date.now() - start,
      };
    }
    return {
      name: 'node-version',
      status: 'fail',
      severity: 'high',
      message: `Node.js ${raw} is below the minimum required version 18.`,
      details: 'Upgrade Node.js to version 18 or later: https://nodejs.org/',
      durationMs: Date.now() - start,
    };
  } catch {
    return {
      name: 'node-version',
      status: 'fail',
      severity: 'high',
      message: 'Unable to determine Node.js version.',
      details: 'Ensure "node" is installed and available on PATH.',
      durationMs: Date.now() - start,
    };
  }
}

function checkDependencies(config: McpServerConfig): TestResult | null {
  const cwd = config.cwd ?? process.cwd();
  const pkgPath = join(cwd, 'package.json');
  if (!existsSync(pkgPath)) return null;

  const start = Date.now();
  const modulesPath = join(cwd, 'node_modules');
  if (existsSync(modulesPath)) {
    return {
      name: 'dependencies',
      status: 'pass',
      severity: 'medium',
      message: 'node_modules directory exists.',
      durationMs: Date.now() - start,
    };
  }
  return {
    name: 'dependencies',
    status: 'fail',
    severity: 'medium',
    message: 'node_modules directory is missing but package.json exists.',
    details: `Run "npm install" in ${cwd} to install dependencies.`,
    durationMs: Date.now() - start,
  };
}

async function checkServerStarts(config: McpServerConfig): Promise<TestResult> {
  const start = Date.now();
  const timeout = 5_000;

  return new Promise<TestResult>((resolve) => {
    const child = spawn(config.command, [...config.args], {
      cwd: config.cwd,
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stderr = '';
    let resolved = false;

    const finish = (result: TestResult) => {
      if (resolved) return;
      resolved = true;
      child.removeAllListeners();
      try { child.kill(); } catch { /* already dead */ }
      resolve(result);
    };

    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      finish({
        name: 'server-starts',
        status: 'fail',
        severity: 'critical',
        message: `Server process failed to spawn: ${err.message}`,
        details: 'Check that the command and arguments are correct.',
        durationMs: Date.now() - start,
      });
    });

    child.on('exit', (code) => {
      finish({
        name: 'server-starts',
        status: 'fail',
        severity: 'critical',
        message: `Server exited immediately with code ${code}.`,
        details: stderr ? `stderr: ${stderr.slice(0, 500)}` : 'No stderr output captured.',
        durationMs: Date.now() - start,
      });
    });

    setTimeout(() => {
      // If it's still running after timeout, it didn't crash — that's a pass
      finish({
        name: 'server-starts',
        status: 'pass',
        severity: 'critical',
        message: 'Server process stayed alive for 5 seconds without crashing.',
        durationMs: Date.now() - start,
      });
    }, timeout);
  });
}

async function checkMcpHandshake(config: McpServerConfig): Promise<TestResult> {
  const start = Date.now();
  const timeout = 5_000;

  try {
    const transport = new StdioClientTransport({
      command: config.command,
      args: [...config.args],
      cwd: config.cwd,
      env: config.env ? { ...process.env, ...config.env } as Record<string, string> : undefined,
    });

    const client = new Client(
      { name: 'mcp-mint-doctor', version: '0.1.0' },
      { capabilities: {} },
    );

    const connectPromise = client.connect(transport);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('MCP handshake timed out after 5s')), timeout),
    );

    await Promise.race([connectPromise, timeoutPromise]);

    // getServerVersion() returns Implementation | undefined after connect()
    const serverVersion = client.getServerVersion?.();
    const serverName = serverVersion?.name ?? 'unknown';

    try { await client.close(); } catch { /* ignore */ }

    return {
      name: 'mcp-handshake',
      status: 'pass',
      severity: 'critical',
      message: `MCP handshake succeeded. Server: ${serverName}.`,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      name: 'mcp-handshake',
      status: 'fail',
      severity: 'critical',
      message: `MCP handshake failed: ${msg}`,
      details: 'Ensure the server implements the MCP initialize handshake correctly.',
      durationMs: Date.now() - start,
    };
  }
}

// ── Public API ─────────────────────────────────────────────────────

export async function diagnose(config: McpServerConfig): Promise<readonly TestResult[]> {
  const results: TestResult[] = [];

  try {
    // 1. Command exists (sync)
    const cmdResult = checkCommandExists(config);
    results.push(cmdResult);

    // If command doesn't exist, skip the rest
    if (cmdResult.status === 'fail') {
      return results;
    }

    // 2. Node version (sync, may be skipped)
    const nodeResult = checkNodeVersion(config);
    if (nodeResult) results.push(nodeResult);

    // 3. Dependencies (sync, may be skipped)
    const depsResult = checkDependencies(config);
    if (depsResult) results.push(depsResult);

    // 4. Server starts (async)
    const startResult = await checkServerStarts(config);
    results.push(startResult);

    // 5. MCP handshake (async) — only if server can start
    if (startResult.status === 'pass') {
      const handshakeResult = await checkMcpHandshake(config);
      results.push(handshakeResult);
    }
  } catch (err) {
    // Catch-all so diagnose never throws
    results.push({
      name: 'doctor-internal',
      status: 'fail',
      severity: 'info',
      message: `Unexpected error during diagnosis: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  return results;
}
