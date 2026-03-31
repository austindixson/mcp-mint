import type {
  TestResult,
  TestStatus,
  Severity,
  McpInitializeResult,
  McpToolListResult,
  McpToolCallResult,
} from '../types/index.js';

function result(
  name: string,
  status: TestStatus,
  severity: Severity,
  message: string,
): TestResult {
  return { name, status, severity, message };
}

export function validateInitializeResult(
  response: McpInitializeResult,
): readonly TestResult[] {
  const results: TestResult[] = [];

  // protocolVersion
  if (!response.protocolVersion) {
    results.push(
      result(
        'initialize.protocolVersion',
        'fail',
        'critical',
        'Missing protocolVersion in initialize response',
      ),
    );
  } else {
    results.push(
      result(
        'initialize.protocolVersion',
        'pass',
        'info',
        `Protocol version: ${response.protocolVersion}`,
      ),
    );
  }

  // serverInfo
  if (!response.serverInfo) {
    results.push(
      result(
        'initialize.serverInfo',
        'fail',
        'critical',
        'Missing serverInfo in initialize response',
      ),
    );
  } else {
    if (!response.serverInfo.name) {
      results.push(
        result(
          'initialize.serverInfo.name',
          'fail',
          'high',
          'Missing serverInfo.name',
        ),
      );
    } else {
      results.push(
        result(
          'initialize.serverInfo.name',
          'pass',
          'info',
          `Server: ${response.serverInfo.name}`,
        ),
      );
    }

    if (!response.serverInfo.version) {
      results.push(
        result(
          'initialize.serverInfo.version',
          'warn',
          'low',
          'Missing serverInfo.version',
        ),
      );
    } else {
      results.push(
        result(
          'initialize.serverInfo.version',
          'pass',
          'info',
          `Version: ${response.serverInfo.version}`,
        ),
      );
    }
  }

  // capabilities
  if (!response.capabilities) {
    results.push(
      result(
        'initialize.capabilities',
        'warn',
        'low',
        'Missing capabilities object (server declares no capabilities)',
      ),
    );
  } else {
    results.push(
      result(
        'initialize.capabilities',
        'pass',
        'info',
        `Capabilities: ${Object.keys(response.capabilities).join(', ') || 'none'}`,
      ),
    );
  }

  return results;
}

export function validateToolListResult(
  response: McpToolListResult,
): readonly TestResult[] {
  const results: TestResult[] = [];

  if (!response.tools) {
    results.push(
      result(
        'tools/list.tools',
        'fail',
        'critical',
        'Missing tools array in tools/list response',
      ),
    );
    return results;
  }

  if (!Array.isArray(response.tools)) {
    results.push(
      result(
        'tools/list.tools',
        'fail',
        'critical',
        'tools field is not an array',
      ),
    );
    return results;
  }

  if (response.tools.length === 0) {
    results.push(
      result(
        'tools/list.tools',
        'warn',
        'medium',
        'Tools list is empty — server exposes no tools',
      ),
    );
    return results;
  }

  results.push(
    result(
      'tools/list.tools',
      'pass',
      'info',
      `Server exposes ${response.tools.length} tool(s)`,
    ),
  );

  return results;
}

export function validateToolCallResult(
  response: McpToolCallResult,
): readonly TestResult[] {
  const results: TestResult[] = [];

  if (!response.content) {
    results.push(
      result(
        'tools/call.content',
        'fail',
        'critical',
        'Missing content array in tool call response',
      ),
    );
    return results;
  }

  if (!Array.isArray(response.content)) {
    results.push(
      result(
        'tools/call.content',
        'fail',
        'critical',
        'content field is not an array',
      ),
    );
    return results;
  }

  if (response.content.length === 0) {
    results.push(
      result(
        'tools/call.content',
        'warn',
        'low',
        'Tool returned empty content array',
      ),
    );
    return results;
  }

  // Validate each content item has a type
  let allHaveType = true;
  for (const item of response.content) {
    if (!item.type) {
      allHaveType = false;
    }
  }

  if (!allHaveType) {
    results.push(
      result(
        'tools/call.content[].type',
        'fail',
        'high',
        'One or more content items missing required "type" field',
      ),
    );
  } else {
    results.push(
      result(
        'tools/call.content',
        'pass',
        'info',
        `Response contains ${response.content.length} content block(s)`,
      ),
    );
  }

  return results;
}
