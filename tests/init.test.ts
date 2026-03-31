import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { scaffold } from '../src/init/index.js';
import { tmpdir } from 'node:os';
import { mkdtempSync } from 'node:fs';

describe('Scaffold (mcp-forge init)', () => {
  let tempDir: string;
  const originalCwd = process.cwd();

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'mcp-forge-test-'));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should scaffold rest-api template', async () => {
    await scaffold('my-server', 'rest-api');

    const dir = join(tempDir, 'my-server');
    expect(existsSync(join(dir, 'package.json'))).toBe(true);
    expect(existsSync(join(dir, 'tsconfig.json'))).toBe(true);
    expect(existsSync(join(dir, 'src/index.ts'))).toBe(true);

    const pkg = readFileSync(join(dir, 'package.json'), 'utf-8');
    expect(pkg).toContain('"name": "my-server"');
  });

  it('should scaffold database template', async () => {
    await scaffold('db-server', 'database');

    const dir = join(tempDir, 'db-server');
    const src = readFileSync(join(dir, 'src/index.ts'), 'utf-8');
    expect(src).toContain('query');
    expect(src).toContain('list_tables');
  });

  it('should scaffold filesystem template', async () => {
    await scaffold('fs-server', 'filesystem');

    const dir = join(tempDir, 'fs-server');
    const src = readFileSync(join(dir, 'src/index.ts'), 'utf-8');
    expect(src).toContain('list_files');
    expect(src).toContain('read_file');
    expect(src).toContain('safePath');
  });

  it('should replace {{name}} placeholders', async () => {
    await scaffold('cool-project', 'rest-api');

    const dir = join(tempDir, 'cool-project');
    const pkg = readFileSync(join(dir, 'package.json'), 'utf-8');
    expect(pkg).toContain('"name": "cool-project"');
    expect(pkg).not.toContain('{{name}}');

    const src = readFileSync(join(dir, 'src/index.ts'), 'utf-8');
    expect(src).not.toContain('{{name}}');
  });

  it('should throw on unknown template', async () => {
    await expect(scaffold('test', 'nonexistent')).rejects.toThrow('Unknown template');
  });

  it('should throw if directory already exists', async () => {
    await scaffold('existing', 'rest-api');
    await expect(scaffold('existing', 'rest-api')).rejects.toThrow('already exists');
  });
});
