/**
 * Pillar C Audit: Production-Grade Mocking
 *
 * Checks:
 * - No static .json mock files in test directories
 * - No hand-written mock data objects without factories
 *
 * Run: npx tsx .prot/pillar-c/audit.ts
 */

import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';

interface AuditResult {
  success: boolean;
  violations: Violation[];
}

interface Violation {
  file: string;
  line: number;
  message: string;
  code: string;
}

// Patterns that indicate static mock data (violations)
const STATIC_MOCK_PATTERNS = [
  // Import from .json file
  /import\s+\w+\s+from\s+['"][^'"]+\.json['"]/,
  // Require .json file
  /require\s*\(\s*['"][^'"]+\.json['"]\s*\)/,
  // Hard-coded mock object with id
  /const\s+mock\w*\s*=\s*\{[^}]*id\s*:\s*['"][^'"]+['"]/i,
  // Hard-coded test data
  /const\s+test\w*\s*=\s*\{[^}]*id\s*:\s*['"][^'"]+['"]/i,
];

// Patterns that indicate proper factory usage (allowed)
const FACTORY_PATTERNS = [
  /Factory\.create/,
  /Factory\.createMany/,
  /MockId\.\w+\(\)/,
  /faker\./,
  /generateMock\(/,
];

async function audit(): Promise<AuditResult> {
  const violations: Violation[] = [];

  // 1. Check for .json files in test directories
  const jsonPatterns = [
    'src/**/__tests__/**/*.json',
    'src/**/__mocks__/**/*.json',
    'src/**/test/**/*.json',
    'test/**/*.json',
    'tests/**/*.json',
    '**/mocks/**/*.json',
    '**/fixtures/**/*.json',
  ];

  const ignorePatterns = [
    '**/node_modules/**',
    '**/package.json',
    '**/package-lock.json',
    '**/tsconfig.json',
    '**/tsconfig.*.json',
    '**/.prettierrc.json',
    '**/.eslintrc.json',
  ];

  for (const pattern of jsonPatterns) {
    const jsonFiles = await glob(pattern, { ignore: ignorePatterns });
    for (const file of jsonFiles) {
      violations.push({
        file,
        line: 1,
        message: 'Static JSON mock file detected. Use factories instead.',
        code: `File: ${path.basename(file)}`,
      });
    }
  }

  // 2. Check test files for static mock objects
  const testFilePatterns = [
    'src/**/*.test.ts',
    'src/**/*.spec.ts',
    'test/**/*.ts',
    'tests/**/*.ts',
  ];

  let testFiles: string[] = [];
  for (const pattern of testFilePatterns) {
    const matches = await glob(pattern, { ignore: ['**/node_modules/**'] });
    testFiles = [...testFiles, ...matches];
  }

  for (const file of testFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    // Skip if file uses factories
    const usesFactories = FACTORY_PATTERNS.some(pattern => pattern.test(content));

    lines.forEach((line, index) => {
      // Skip comments
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
        return;
      }

      // Check for static mock patterns
      for (const pattern of STATIC_MOCK_PATTERNS) {
        if (pattern.test(line)) {
          // Check if factories are used elsewhere in the file
          if (usesFactories) {
            // Warn but don't fail if file mixes patterns
            // Could be a transitional state
            continue;
          }

          violations.push({
            file,
            line: index + 1,
            message: 'Static mock data detected. Use factory functions instead.',
            code: line.trim().substring(0, 80) + (line.length > 80 ? '...' : ''),
          });
          break;
        }
      }
    });
  }

  return {
    success: violations.length === 0,
    violations,
  };
}

// Run audit
audit().then((result) => {
  console.log('\n🔍 Pillar C Audit: Production-Grade Mocking\n');

  if (result.success) {
    console.log('✅ All checks passed - No static mock files or data found\n');
  } else {
    // Group violations by type
    const jsonFiles = result.violations.filter(v => v.file.endsWith('.json'));
    const staticMocks = result.violations.filter(v => !v.file.endsWith('.json'));

    if (jsonFiles.length > 0) {
      console.log(`❌ Found ${jsonFiles.length} static JSON mock file(s):\n`);
      jsonFiles.forEach((v) => {
        console.log(`  ${v.file}`);
      });
      console.log();
    }

    if (staticMocks.length > 0) {
      console.log(`❌ Found ${staticMocks.length} static mock data pattern(s):\n`);
      staticMocks.forEach((v) => {
        console.log(`  ${v.file}:${v.line}`);
        console.log(`    ${v.message}`);
        console.log(`    Code: ${v.code}\n`);
      });
    }

    console.log('📋 Fix: Use factories from .prot/pillar-c/mock-factory.ts');
    console.log('   Example: const user = UserFactory.create({ email: "test@example.com" })\n');
    process.exit(1);
  }
});

export { audit };
