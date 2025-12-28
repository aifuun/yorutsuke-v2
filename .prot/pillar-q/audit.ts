/**
 * Pillar Q Audit: Idempotency
 *
 * Checks:
 * - T3 saga files use withIdempotency() or equivalent barrier
 * - Saga commands have intentId field
 * - No direct side-effect calls without idempotency wrapper
 *
 * Run: npx tsx .prot/pillar-q/audit.ts
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

// Patterns that indicate idempotency is being used (good)
const IDEMPOTENCY_PATTERNS = [
  // withIdempotency wrapper
  /withIdempotency\s*\(/,
  // intentId in parameters or destructuring
  /\bintentId\s*[,:]/,
  // IdempotencyCache usage
  /IdempotencyCache/,
  // Cache check pattern
  /cache\.(check|get)\s*\(\s*.*intentId/,
  // External API idempotency key
  /idempotencyKey\s*:/,
];

// Patterns that indicate T3 saga files (need to check)
const SAGA_INDICATORS = [
  // Saga function naming
  /Saga\s*[=(]/,
  /async\s+function\s+\w+Saga/,
  // Compensation pattern
  /compensations?\s*[.:]/i,
  /compensation/i,
  // Common saga operations
  /executeCompensations/,
];

// Patterns that indicate risky operations without idempotency
const RISKY_PATTERNS = [
  // Direct payment/charge calls
  { pattern: /\.(charge|pay|transfer|debit|credit)\s*\(/, message: 'Payment operation without idempotency' },
  // Stripe operations
  { pattern: /stripe\.\w+\.create\s*\(/, message: 'Stripe operation without idempotency' },
  // Generic write operations in saga context
  { pattern: /await\s+\w+\.(save|update|delete|create)\s*\(/, message: 'Write operation in saga - ensure idempotency' },
];

async function audit(): Promise<AuditResult> {
  const violations: Violation[] = [];

  // Find saga/workflow files
  const patterns = [
    'src/**/workflows/**/*.ts',
    'src/**/sagas/**/*.ts',
    'src/**/*Saga.ts',
    'src/**/*saga.ts',
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

    // Check if this file contains saga-related code
    const isSagaFile = SAGA_INDICATORS.some(pattern => pattern.test(content));
    if (!isSagaFile) {
      continue; // Skip non-saga files in saga directories
    }

    // Check if file uses idempotency
    const hasIdempotency = IDEMPOTENCY_PATTERNS.some(pattern => pattern.test(content));

    if (!hasIdempotency) {
      // File is a saga but has no idempotency - flag entire file
      violations.push({
        file,
        line: 1,
        message: 'T3 saga file without idempotency barrier',
        code: 'Missing withIdempotency() or intentId check',
      });
    }

    // Also check for specific risky patterns
    lines.forEach((line, index) => {
      // Skip comments
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
        return;
      }

      // If file has idempotency, skip risky pattern checks
      // (assume patterns are inside the barrier)
      if (hasIdempotency) {
        return;
      }

      for (const { pattern, message } of RISKY_PATTERNS) {
        if (pattern.test(line)) {
          violations.push({
            file,
            line: index + 1,
            message,
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
  console.log('\n🔍 Pillar Q Audit: Idempotency\n');

  if (result.success) {
    console.log('✅ All checks passed - T3 sagas have idempotency barriers\n');
  } else {
    console.log(`❌ Found ${result.violations.length} violation(s):\n`);
    result.violations.forEach((v) => {
      console.log(`  ${v.file}:${v.line}`);
      console.log(`    ${v.message}`);
      console.log(`    Code: ${v.code}\n`);
    });
    console.log('📋 Fix: Use withIdempotency() wrapper from .prot/pillar-q/idempotency.ts');
    console.log('   Example:');
    console.log('     return withIdempotency(cache, cmd.intentId, async () => {');
    console.log('       // All saga logic here');
    console.log('     });\n');
    process.exit(1);
  }
});

export { audit };
