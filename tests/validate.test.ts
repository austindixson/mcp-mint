import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadManifest, validateManifest } from '../src/validate.js';

describe('Validate (offline mode)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'mcp-forge-validate-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('loadManifest', () => {
    it('should load a valid manifest', () => {
      const manifest = {
        name: 'test-server',
        version: '1.0.0',
        tools: [
          {
            name: 'greet',
            description: 'Greet a user by name',
            inputSchema: {
              type: 'object',
              properties: { name: { type: 'string' } },
              required: ['name'],
            },
          },
        ],
      };

      const file = join(tempDir, 'manifest.json');
      writeFileSync(file, JSON.stringify(manifest));

      const loaded = loadManifest(file);
      expect(loaded.name).toBe('test-server');
      expect(loaded.version).toBe('1.0.0');
      expect(loaded.tools).toHaveLength(1);
      expect(loaded.tools[0]!.name).toBe('greet');
    });

    it('should throw on missing name', () => {
      const file = join(tempDir, 'bad.json');
      writeFileSync(file, JSON.stringify({ tools: [] }));
      expect(() => loadManifest(file)).toThrow('name');
    });

    it('should throw on missing tools', () => {
      const file = join(tempDir, 'bad2.json');
      writeFileSync(file, JSON.stringify({ name: 'test' }));
      expect(() => loadManifest(file)).toThrow('tools');
    });

    it('should default version to 0.0.0', () => {
      const file = join(tempDir, 'no-ver.json');
      writeFileSync(file, JSON.stringify({ name: 'test', tools: [] }));
      const loaded = loadManifest(file);
      expect(loaded.version).toBe('0.0.0');
    });
  });

  describe('validateManifest', () => {
    it('should return grade A for clean manifest', () => {
      const manifest = {
        name: 'clean-server',
        version: '1.0.0',
        tools: [
          {
            name: 'get_data',
            description: 'Retrieve data from the configured source',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'number', description: 'Record ID' },
              },
              required: ['id'],
            },
          },
        ],
      };

      const report = validateManifest(manifest);
      expect(report.summary.grade).toBe('A');
      expect(report.summary.failed).toBe(0);
    });

    it('should flag security issues for URL parameters', () => {
      const manifest = {
        name: 'risky-server',
        version: '1.0.0',
        tools: [
          {
            name: 'fetch',
            description: 'Fetch data from any URL provided by the user',
            inputSchema: {
              type: 'object',
              properties: {
                url: { type: 'string', description: 'URL to fetch' },
              },
            },
          },
        ],
      };

      const report = validateManifest(manifest);
      const secFindings = report.suites.find((s) => s.suite === 'Security Scan');
      expect(secFindings?.results.some((r) => r.name.includes('ssrf'))).toBe(true);
    });

    it('should flag schema issues for missing descriptions', () => {
      const manifest = {
        name: 'lazy-server',
        version: '1.0.0',
        tools: [
          { name: 'do_thing' },
          { name: 'do_other_thing' },
        ],
      };

      const report = validateManifest(manifest);
      expect(report.summary.warnings).toBeGreaterThanOrEqual(2);
    });

    it('should handle empty tools list', () => {
      const manifest = {
        name: 'empty-server',
        version: '1.0.0',
        tools: [],
      };

      const report = validateManifest(manifest);
      expect(report.summary.grade).toBe('A');
      expect(report.summary.failed).toBe(0);
    });
  });
});
