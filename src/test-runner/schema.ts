import type { ToolDefinition, SchemaViolation, Severity } from '../types/index.js';

const TOOL_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;
const MIN_DESCRIPTION_LENGTH = 10;

export function validateToolDefinitions(
  tools: readonly ToolDefinition[],
): readonly SchemaViolation[] {
  const violations: SchemaViolation[] = [];
  const seenNames = new Set<string>();

  for (const tool of tools) {
    validateName(tool, violations, seenNames);
    validateDescription(tool, violations);
    validateInputSchema(tool, violations);
  }

  return violations;
}

function violation(
  tool: string,
  field: string,
  message: string,
  severity: Severity,
): SchemaViolation {
  return { tool, field, message, severity };
}

function validateName(
  tool: ToolDefinition,
  violations: SchemaViolation[],
  seenNames: Set<string>,
): void {
  const name = tool.name;

  if (name === undefined || name === null) {
    violations.push(
      violation('(unknown)', 'name', 'Tool name is missing', 'critical'),
    );
    return;
  }

  if (name === '') {
    violations.push(
      violation('(unknown)', 'name', 'Tool name is empty', 'critical'),
    );
    return;
  }

  if (!TOOL_NAME_PATTERN.test(name)) {
    violations.push(
      violation(
        name,
        'name',
        `Tool name contains invalid characters: must match ${TOOL_NAME_PATTERN}`,
        'high',
      ),
    );
  }

  if (seenNames.has(name)) {
    violations.push(
      violation(name, 'name', `Duplicate tool name: "${name}"`, 'critical'),
    );
  }
  seenNames.add(name);
}

function validateDescription(
  tool: ToolDefinition,
  violations: SchemaViolation[],
): void {
  const name = tool.name || '(unknown)';

  if (!tool.description) {
    violations.push(
      violation(name, 'description', 'Tool is missing a description', 'medium'),
    );
    return;
  }

  if (tool.description.length < MIN_DESCRIPTION_LENGTH) {
    violations.push(
      violation(
        name,
        'description',
        `Description is too short (${tool.description.length} chars, minimum ${MIN_DESCRIPTION_LENGTH})`,
        'low',
      ),
    );
  }
}

function validateInputSchema(
  tool: ToolDefinition,
  violations: SchemaViolation[],
): void {
  const name = tool.name || '(unknown)';
  const schema = tool.inputSchema;

  if (!schema) return;

  const schemaType = (schema as Record<string, unknown>).type;
  if (schemaType !== 'object') {
    violations.push(
      violation(
        name,
        'inputSchema.type',
        `inputSchema.type must be "object", got "${String(schemaType)}"`,
        'high',
      ),
    );
    return;
  }

  const properties = (schema as Record<string, unknown>).properties;
  if (!properties || typeof properties !== 'object') {
    violations.push(
      violation(
        name,
        'inputSchema.properties',
        'inputSchema is missing "properties" field',
        'medium',
      ),
    );
  }
}
