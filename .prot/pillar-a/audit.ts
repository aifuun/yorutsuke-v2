/**
 * Pillar A Audit: Nominal Typing
 *
 * Checks:
 * - No primitive `id: string` without branded types
 * - No `userId: string`, `orderId: string` etc.
 *
 * Run: npx tsx .prot/pillar-a/audit.ts
 */

import { glob } from 'glob';
import * as fs from 'fs';

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

// Patterns that indicate primitive IDs (violations)
const PRIMITIVE_ID_PATTERNS = [
  // Direct id: string
  /\bid\s*:\s*string\b/,
  // Common entity IDs as primitives
  /\b(userId|orderId|productId|customerId|itemId|accountId)\s*:\s*string\b/i,
  // ID in function parameters
  /function\s+\w+\s*\(\s*id\s*:\s*string\b/,
  // Arrow function with primitive ID
  /\(\s*id\s*:\s*string\s*\)/,
];

// Patterns that indicate proper branded types (allowed)
const BRANDED_TYPE_PATTERNS = [
  // Branded type definition
  /type\s+\w+Id\s*=\s*string\s*&\s*\{/,
  // Using a branded type
  /\bid\s*:\s*\w+Id\b/,
  /\b\w+Id\s*:\s*\w+Id\b/,
];

async function audit(): Promise<AuditResult> {
  const violations: Violation[] = [];

  // Find model/entity files
  const patterns = [
    'src/**/model/**/*.ts',
    'src/**/models/**/*.ts',
    'src/**/entities/**/*.ts',
    'src/**/types/**/*.ts',
    'src/01_domains/**/*.ts',
  ];

  const ignorePatterns = [
    '**/*.test.ts',
    '**/*.spec.ts',
    '**/node_modules/**',
    '**/*.d.ts',
  ];

  let files: string[] = [];
  for (const pattern of patterns) {
    const matches = await glob(pattern, { ignore: ignorePatterns });
    files = [...files, ...matches];
  }

  // Deduplicate
  files = [...new Set(files)];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Skip comments
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
        return;
      }

      // Skip lines that define branded types
      if (BRANDED_TYPE_PATTERNS.some(pattern => pattern.test(line))) {
        return;
      }

      // Check for violations
      for (const pattern of PRIMITIVE_ID_PATTERNS) {
        if (pattern.test(line)) {
          violations.push({
            file,
            line: index + 1,
            message: 'Primitive ID type detected. Use Branded Type instead.',
            code: line.trim(),
          });
          break; // Only report once per line
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
  console.log('\n🔍 Pillar A Audit: Nominal Typing\n');

  if (result.success) {
    console.log('✅ All checks passed - No primitive ID types found\n');
  } else {
    console.log(`❌ Found ${result.violations.length} violation(s):\n`);
    result.violations.forEach((v) => {
      console.log(`  ${v.file}:${v.line}`);
      console.log(`    ${v.message}`);
      console.log(`    Code: ${v.code}\n`);
    });
    console.log('📋 Fix: Use Branded Types from .prot/pillar-a/branded.ts');
    console.log('   Example: type UserId = string & { readonly __brand: "UserId" }\n');
    process.exit(1);
  }
});

export { audit };
