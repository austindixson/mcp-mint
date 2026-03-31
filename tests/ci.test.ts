import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generateCiWorkflow, writeCiWorkflow } from '../src/ci.js';

describe('CI: generateCiWorkflow', () => {
  it('should return a valid YAML-like string with required keys', () => {
    const yaml = generateCiWorkflow('node', ['server.js']);

    expect(yaml).toContain('name:');
    expect(yaml).toContain('on:');
    expect(yaml).toContain('jobs:');
    expect(yaml).toContain('steps:');
    expect(yaml).toContain('runs-on:');
  });

  it('should include the server command and args', () => {
    const yaml = generateCiWorkflow('python3', ['my_server.py', '--port', '8080']);

    expect(yaml).toContain('python3');
    expect(yaml).toContain('my_server.py');
    expect(yaml).toContain('--port');
    expect(yaml).toContain('8080');
  });

  it('should trigger on push to main and pull requests', () => {
    const yaml = generateCiWorkflow('node', ['server.js']);

    expect(yaml).toContain('push:');
    expect(yaml).toContain('branches: [main]');
    expect(yaml).toContain('pull_request:');
  });

  it('should install Node 22 and run npm ci', () => {
    const yaml = generateCiWorkflow('node', ['server.js']);

    expect(yaml).toContain("node-version: '22'");
    expect(yaml).toContain('npm ci');
  });

  it('should check grade and fail on D or F', () => {
    const yaml = generateCiWorkflow('node', ['server.js']);

    expect(yaml).toContain('Check grade');
    expect(yaml).toContain('"D"');
    expect(yaml).toContain('"F"');
    expect(yaml).toContain('exit 1');
  });

  it('should upload mcp-report.json as artifact', () => {
    const yaml = generateCiWorkflow('node', ['server.js']);

    expect(yaml).toContain('upload-artifact');
    expect(yaml).toContain('mcp-report.json');
  });

  it('should produce mcp-report.json via --json flag', () => {
    const yaml = generateCiWorkflow('npx', ['tsx', 'server.ts']);

    expect(yaml).toContain('--json > mcp-report.json');
  });
});

describe('CI: writeCiWorkflow', () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should create .github/workflows/mcp-ci.yml in the project dir', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'mcp-ci-test-'));

    writeCiWorkflow(tempDir, 'node', ['server.js']);

    const filePath = join(tempDir, '.github', 'workflows', 'mcp-ci.yml');
    expect(existsSync(filePath)).toBe(true);

    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('node');
    expect(content).toContain('server.js');
  });

  it('should create .github/workflows/ directory if it does not exist', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'mcp-ci-test-'));
    const workflowDir = join(tempDir, '.github', 'workflows');

    expect(existsSync(workflowDir)).toBe(false);

    writeCiWorkflow(tempDir, 'python3', ['main.py']);

    expect(existsSync(workflowDir)).toBe(true);
    expect(existsSync(join(workflowDir, 'mcp-ci.yml'))).toBe(true);
  });
});
