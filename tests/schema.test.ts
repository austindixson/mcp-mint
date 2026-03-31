import { describe, it, expect } from 'vitest';
import { validateToolDefinitions } from '../src/test-runner/schema.js';
import type { ToolDefinition, SchemaViolation } from '../src/types/index.js';

describe('Schema Validator', () => {
  describe('validateToolDefinitions', () => {
    it('should pass for a valid tool definition', () => {
      const tools: ToolDefinition[] = [
        {
          name: 'get_weather',
          description: 'Get current weather for a location',
          inputSchema: {
            type: 'object',
            properties: {
              location: { type: 'string', description: 'City name' },
            },
            required: ['location'],
          },
        },
      ];

      const violations = validateToolDefinitions(tools);
      expect(violations).toEqual([]);
    });

    it('should flag missing tool name', () => {
      const tools = [{ description: 'A tool' }] as unknown as ToolDefinition[];

      const violations = validateToolDefinitions(tools);
      expect(violations).toContainEqual(
        expect.objectContaining({
          field: 'name',
          severity: 'critical',
        }),
      );
    });

    it('should flag empty tool name', () => {
      const tools: ToolDefinition[] = [{ name: '', description: 'A tool' }];

      const violations = validateToolDefinitions(tools);
      expect(violations).toContainEqual(
        expect.objectContaining({
          field: 'name',
          severity: 'critical',
          message: expect.stringContaining('empty'),
        }),
      );
    });

    it('should warn on missing description', () => {
      const tools: ToolDefinition[] = [{ name: 'my_tool' }];

      const violations = validateToolDefinitions(tools);
      expect(violations).toContainEqual(
        expect.objectContaining({
          tool: 'my_tool',
          field: 'description',
          severity: 'medium',
        }),
      );
    });

    it('should warn on short description', () => {
      const tools: ToolDefinition[] = [
        { name: 'my_tool', description: 'Tool' },
      ];

      const violations = validateToolDefinitions(tools);
      expect(violations).toContainEqual(
        expect.objectContaining({
          tool: 'my_tool',
          field: 'description',
          severity: 'low',
        }),
      );
    });

    it('should flag invalid inputSchema type', () => {
      const tools: ToolDefinition[] = [
        {
          name: 'bad_schema',
          description: 'A tool with bad schema',
          inputSchema: { type: 'string' },
        },
      ];

      const violations = validateToolDefinitions(tools);
      expect(violations).toContainEqual(
        expect.objectContaining({
          tool: 'bad_schema',
          field: 'inputSchema.type',
          severity: 'high',
        }),
      );
    });

    it('should flag inputSchema missing properties', () => {
      const tools: ToolDefinition[] = [
        {
          name: 'no_props',
          description: 'A tool without properties',
          inputSchema: { type: 'object' },
        },
      ];

      const violations = validateToolDefinitions(tools);
      expect(violations).toContainEqual(
        expect.objectContaining({
          tool: 'no_props',
          field: 'inputSchema.properties',
          severity: 'medium',
        }),
      );
    });

    it('should flag duplicate tool names', () => {
      const tools: ToolDefinition[] = [
        { name: 'duplicate', description: 'First tool' },
        { name: 'duplicate', description: 'Second tool' },
      ];

      const violations = validateToolDefinitions(tools);
      expect(violations).toContainEqual(
        expect.objectContaining({
          tool: 'duplicate',
          field: 'name',
          severity: 'critical',
          message: expect.stringContaining('Duplicate'),
        }),
      );
    });

    it('should flag tool names with invalid characters', () => {
      const tools: ToolDefinition[] = [
        { name: 'my tool!', description: 'Bad name' },
      ];

      const violations = validateToolDefinitions(tools);
      expect(violations).toContainEqual(
        expect.objectContaining({
          tool: 'my tool!',
          field: 'name',
          severity: 'high',
        }),
      );
    });

    it('should handle empty tool list', () => {
      const violations = validateToolDefinitions([]);
      expect(violations).toEqual([]);
    });

    it('should collect multiple violations across tools', () => {
      const tools: ToolDefinition[] = [
        { name: '' },
        { name: 'ok_tool', inputSchema: { type: 'array' } },
      ];

      const violations = validateToolDefinitions(tools);
      expect(violations.length).toBeGreaterThanOrEqual(2);
    });
  });
});
