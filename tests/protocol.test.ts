import { describe, it, expect } from 'vitest';
import {
  validateInitializeResult,
  validateToolListResult,
  validateToolCallResult,
} from '../src/test-runner/protocol.js';
import type { TestResult } from '../src/types/index.js';

describe('Protocol Compliance', () => {
  describe('validateInitializeResult', () => {
    it('should pass for valid initialize response', () => {
      const result = {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'test-server', version: '1.0.0' },
      };

      const tests = validateInitializeResult(result);
      const failed = tests.filter((t) => t.status === 'fail');
      expect(failed).toEqual([]);
    });

    it('should fail on missing protocolVersion', () => {
      const result = {
        capabilities: {},
        serverInfo: { name: 'test', version: '1.0' },
      };

      const tests = validateInitializeResult(result as any);
      expect(tests).toContainEqual(
        expect.objectContaining({
          status: 'fail',
          name: expect.stringContaining('protocolVersion'),
        }),
      );
    });

    it('should fail on missing serverInfo', () => {
      const result = {
        protocolVersion: '2024-11-05',
        capabilities: {},
      };

      const tests = validateInitializeResult(result as any);
      expect(tests).toContainEqual(
        expect.objectContaining({
          status: 'fail',
          name: expect.stringContaining('serverInfo'),
        }),
      );
    });

    it('should fail on missing serverInfo.name', () => {
      const result = {
        protocolVersion: '2024-11-05',
        capabilities: {},
        serverInfo: { version: '1.0' },
      };

      const tests = validateInitializeResult(result as any);
      expect(tests).toContainEqual(
        expect.objectContaining({
          status: 'fail',
          name: expect.stringContaining('serverInfo.name'),
        }),
      );
    });

    it('should warn on missing capabilities', () => {
      const result = {
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'test', version: '1.0' },
      };

      const tests = validateInitializeResult(result as any);
      expect(tests).toContainEqual(
        expect.objectContaining({
          status: 'warn',
          name: expect.stringContaining('capabilities'),
        }),
      );
    });
  });

  describe('validateToolListResult', () => {
    it('should pass for valid tool list', () => {
      const result = {
        tools: [
          {
            name: 'get_weather',
            description: 'Get weather for a city',
            inputSchema: {
              type: 'object',
              properties: { city: { type: 'string' } },
            },
          },
        ],
      };

      const tests = validateToolListResult(result);
      const failed = tests.filter((t) => t.status === 'fail');
      expect(failed).toEqual([]);
    });

    it('should fail on missing tools array', () => {
      const result = {};

      const tests = validateToolListResult(result as any);
      expect(tests).toContainEqual(
        expect.objectContaining({
          status: 'fail',
          name: expect.stringContaining('tools'),
        }),
      );
    });

    it('should fail if tools is not an array', () => {
      const result = { tools: 'not-an-array' };

      const tests = validateToolListResult(result as any);
      expect(tests).toContainEqual(
        expect.objectContaining({
          status: 'fail',
        }),
      );
    });

    it('should warn on empty tools array', () => {
      const result = { tools: [] };

      const tests = validateToolListResult(result);
      expect(tests).toContainEqual(
        expect.objectContaining({
          status: 'warn',
          message: expect.stringContaining('empty'),
        }),
      );
    });
  });

  describe('validateToolCallResult', () => {
    it('should pass for valid tool call response', () => {
      const result = {
        content: [{ type: 'text', text: 'Hello world' }],
      };

      const tests = validateToolCallResult(result);
      const failed = tests.filter((t) => t.status === 'fail');
      expect(failed).toEqual([]);
    });

    it('should fail on missing content', () => {
      const result = {};

      const tests = validateToolCallResult(result as any);
      expect(tests).toContainEqual(
        expect.objectContaining({
          status: 'fail',
          name: expect.stringContaining('content'),
        }),
      );
    });

    it('should fail if content is not an array', () => {
      const result = { content: 'not-array' };

      const tests = validateToolCallResult(result as any);
      expect(tests).toContainEqual(
        expect.objectContaining({
          status: 'fail',
        }),
      );
    });

    it('should warn on empty content array', () => {
      const result = { content: [] };

      const tests = validateToolCallResult(result);
      expect(tests).toContainEqual(
        expect.objectContaining({
          status: 'warn',
          message: expect.stringContaining('empty'),
        }),
      );
    });

    it('should fail if content items lack type field', () => {
      const result = {
        content: [{ text: 'no type field' }],
      };

      const tests = validateToolCallResult(result as any);
      expect(tests).toContainEqual(
        expect.objectContaining({
          status: 'fail',
          name: expect.stringContaining('content[].type'),
        }),
      );
    });

    it('should pass for error responses with isError flag', () => {
      const result = {
        content: [{ type: 'text', text: 'Something went wrong' }],
        isError: true,
      };

      const tests = validateToolCallResult(result);
      const failed = tests.filter((t) => t.status === 'fail');
      expect(failed).toEqual([]);
    });
  });
});
