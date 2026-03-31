import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { REST_API_TEMPLATE } from './templates/rest-api.js';
import { DATABASE_TEMPLATE } from './templates/database.js';
import { FILESYSTEM_TEMPLATE } from './templates/filesystem.js';

type TemplateType = 'rest-api' | 'database' | 'filesystem';

const TEMPLATES: Record<TemplateType, Record<string, string>> = {
  'rest-api': REST_API_TEMPLATE,
  database: DATABASE_TEMPLATE,
  filesystem: FILESYSTEM_TEMPLATE,
};

export async function scaffold(name: string, templateType: string): Promise<void> {
  const template = TEMPLATES[templateType as TemplateType];
  if (!template) {
    const valid = Object.keys(TEMPLATES).join(', ');
    throw new Error(`Unknown template "${templateType}". Available: ${valid}`);
  }

  const targetDir = join(process.cwd(), name);

  if (existsSync(targetDir)) {
    throw new Error(`Directory "${name}" already exists`);
  }

  mkdirSync(targetDir, { recursive: true });

  for (const [filePath, content] of Object.entries(template)) {
    const fullPath = join(targetDir, filePath);
    const dir = join(fullPath, '..');
    mkdirSync(dir, { recursive: true });

    const rendered = content.replace(/\{\{name\}\}/g, name);
    writeFileSync(fullPath, rendered, 'utf-8');
    console.log(chalk.green(`  + ${filePath}`));
  }

  console.log(chalk.bold(`\nDone! Created ${name}/`));
  console.log(chalk.gray(`\nNext steps:`));
  console.log(`  cd ${name}`);
  console.log(`  npm install`);
  console.log(`  npm run dev`);
  console.log(`\nTest your server:`);
  console.log(`  mcp-forge test node dist/index.js`);
}
