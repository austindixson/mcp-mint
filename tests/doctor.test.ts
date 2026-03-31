import { describe, it, expect } from 'vitest';
import { diagnose } from '../src/doctor.js';
import type { McpServerConfig } from '../src/types/index.js';

describe('Doctor: diagnose', () => {
  it('should return passing results for a valid echo server', async () => {
    const config: McpServerConfig = {
      command: 'npx',
      args: ['tsx', 'examples/echo-server.ts'],
      cwd: process.env.PROJECT_ROOT || process.cwd(),
    };

    const results = await diagnose(config);

    expect(results.length).toBeGreaterThanOrEqual(1);

    const commandCheck = results.find((r) => r.name === 'command-exists');
    expect(commandCheck).toBeDefined();
    expect(commandCheck?.status).toBe('pass');

    const nodeCheck = results.find((r) => r.name === 'node-version');
    expect(nodeCheck).toBeDefined();
    expect(nodeCheck?.status).toBe('pass');

    const startCheck = results.find((r) => r.name === 'server-starts');
    expect(startCheck).toBeDefined();
    expect(startCheck?.status).toBe('pass');

    const handshakeCheck = results.find((r) => r.name === 'mcp-handshake');
    expect(handshakeCheck).toBeDefined();
    expect(handshakeCheck?.status).toBe('pass');
  }, 15000);

  it('should fail command-exists for a nonexistent binary', async () => {
    const config: McpServerConfig = {
      command: 'nonexistent-binary-xyz',
      args: [],
    };

    const results = await diagnose(config);

    expect(results.length).toBeGreaterThanOrEqual(1);

    const commandCheck = results.find((r) => r.name === 'command-exists');
    expect(commandCheck).toBeDefined();
    expect(commandCheck?.status).toBe('fail');
    expect(commandCheck?.message).toContain('nonexistent-binary-xyz');

    // Should short-circuit — no further checks
    expect(results.find((r) => r.name === 'server-starts')).toBeUndefined();
  }, 15000);

  it('should always return results and never throw', async () => {
    const config: McpServerConfig = {
      command: 'nonexistent-binary-xyz',
      args: ['--bad-flag'],
    };

    // Must not throw
    const results = await diagnose(config);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThanOrEqual(1);

    // Every result has required fields
    for (const r of results) {
      expect(r.name).toBeTruthy();
      expect(['pass', 'fail', 'warn', 'skip']).toContain(r.status);
      expect(r.message).toBeTruthy();
    }
  }, 15000);
});
