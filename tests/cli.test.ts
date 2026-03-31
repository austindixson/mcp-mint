import { describe, it, expect } from 'vitest';
import { createCli } from '../src/cli.js';

describe('CLI', () => {
  it('should create a CLI program', () => {
    const cli = createCli();
    expect(cli.name()).toBe('mcp-forge');
  });

  it('should have test command', () => {
    const cli = createCli();
    const testCmd = cli.commands.find((c) => c.name() === 'test');
    expect(testCmd).toBeDefined();
  });

  it('should have init command', () => {
    const cli = createCli();
    const initCmd = cli.commands.find((c) => c.name() === 'init');
    expect(initCmd).toBeDefined();
  });

  it('should have version set', () => {
    const cli = createCli();
    expect(cli.version()).toBe('0.1.0');
  });
});
