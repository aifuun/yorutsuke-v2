/**
 * Pillar M Audit: Saga Compensation
 *
 * Checks:
 * - Saga files must have compensation logic
 * - Every saga step should push to compensation stack before execute
 * - Compensation must be executed in reverse order (LIFO)
 *
 * Run: npx tsx .prot/pillar-m/audit.ts
 */

import { glob } from 'glob';
import * as fs from 'fs';

interface AuditResult {
  success: boolean;
  violations: Violation[];
  warnings: Violation[];
}

interface Violation {
  file: string;
  line: number;
  message: string;
  code: string;
}

// Patterns that indicate saga files
const SAGA_FILE_PATTERNS = [
  /saga/i,
  /workflow/i,
];

// Patterns that indicate proper compensation
const COMPENSATION_PATTERNS = [
  // Compensation array/stack
  /compensation[s]?\s*[:\=]/i,
  /compensationStack/i,
  // Push before execute pattern
  /\.push\s*\(\s*(?:async\s*)?\(\s*\)\s*=>/,
  // Pop for rollback
  /\.pop\s*\(\s*\)/,
  // Rollback/undo keywords
  /rollback|undo|revert|compensate/i,
];

// Patterns that indicate saga execution without compensation
const SAGA_WITHOUT_COMPENSATION = [
  // Sequential awaits without compensation
  /await\s+\w+\.\w+\([^)]*\)\s*;\s*\n\s*await\s+\w+\.\w+/,
];

// Required elements in a saga file
const REQUIRED_ELEMENTS = {
  compensationArray: /const\s+compensation[s]?\s*[:\=]|let\s+compensation[s]?\s*[:\=]/i,
  pushBeforeExecute: /push\s*\([^)]*\)\s*[;\n]\s*await/,
  popOnError: /catch\s*\([^)]*\)\s*\{[^}]*\.pop\s*\(\s*\)/s,
  reverseOrder: /while\s*\(\s*\w+\.length|\.reverse\s*\(\s*\)\.forEach|for.*--/,
};

const CHECK_PATTERNS = [
  'src/**/workflows/**/*.ts',
  'src/**/sagas/**/*.ts',
  'src/**/*Saga.ts',
  'src/**/*saga.ts',
  'src/**/*Workflow.ts',
];

const IGNORE_PATTERNS = [
  '**/*.test.ts',
  '**/*.spec.ts',
  '**/node_modules/**',
  '**/*.d.ts',
];

async function audit(): Promise<AuditResult> {
  const violations: Violation[] = [];
  const warnings: Violation[] = [];

  let files: string[] = [];
  for (const pattern of CHECK_PATTERNS) {
    const matches = await glob(pattern, { ignore: IGNORE_PATTERNS });
    files = [...files, ...matches];
  }

  // Deduplicate
  files = [...new Set(files)];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    // Check if this looks like a saga file
    const isSagaFile = SAGA_FILE_PATTERNS.some(pattern => pattern.test(file));
    if (!isSagaFile) continue;

    // Check for required elements
    const hasCompensationArray = REQUIRED_ELEMENTS.compensationArray.test(content);
    const hasPushBeforeExecute = REQUIRED_ELEMENTS.pushBeforeExecute.test(content);
    const hasPopOnError = REQUIRED_ELEMENTS.popOnError.test(content);
    const hasReverseOrder = REQUIRED_ELEMENTS.reverseOrder.test(content);

    if (!hasCompensationArray) {
      violations.push({
        file,
        line: 1,
        message: 'Saga file missing compensation array/stack definition.',
        code: 'Expected: const compensations: Compensation[] = []',
      });
    }

    if (!hasPushBeforeExecute && hasCompensationArray) {
      warnings.push({
        file,
        line: 1,
        message: 'Compensation should be pushed BEFORE step execution.',
        code: 'Pattern: compensations.push(() => undo()); await step();',
      });
    }

    if (!hasPopOnError && hasCompensationArray) {
      violations.push({
        file,
        line: 1,
        message: 'Saga missing compensation execution in catch block.',
        code: 'Expected: catch(e) { while(compensations.length) await compensations.pop()(); }',
      });
    }

    if (!hasReverseOrder && hasCompensationArray) {
      warnings.push({
        file,
        line: 1,
        message: 'Compensation should execute in reverse order (LIFO).',
        code: 'Use .pop() or .reverse().forEach() for LIFO execution',
      });
    }

    // Check for sequential awaits without compensation (common anti-pattern)
    lines.forEach((line, index) => {
      // Look for multiple sequential awaits
      if (index > 0) {
        const prevLine = lines[index - 1];
        const currentLine = line;

        if (
          /^\s*await\s+\w+/.test(prevLine) &&
          /^\s*await\s+\w+/.test(currentLine) &&
          !COMPENSATION_PATTERNS.some(p => p.test(content.slice(0, content.indexOf(currentLine))))
        ) {
          // Check if there's compensation between them
          const betweenLines = lines.slice(Math.max(0, index - 5), index).join('\n');
          if (!COMPENSATION_PATTERNS.some(p => p.test(betweenLines))) {
            warnings.push({
              file,
              line: index + 1,
              message: 'Sequential await without visible compensation. Ensure each step has undo logic.',
              code: currentLine.trim(),
            });
          }
        }
      }
    });
  }

  return {
    success: violations.length === 0,
    violations,
    warnings,
  };
}

// Run audit
audit().then((result) => {
  console.log('\n🔍 Pillar M Audit: Saga Compensation\n');

  if (result.warnings.length > 0) {
    console.log(`⚠️  ${result.warnings.length} warning(s):\n`);
    result.warnings.forEach((w) => {
      console.log(`  ${w.file}:${w.line}`);
      console.log(`    ${w.message}`);
      console.log(`    ${w.code}\n`);
    });
  }

  if (result.success) {
    console.log('✅ All checks passed - Saga compensation patterns verified\n');
  } else {
    console.log(`❌ Found ${result.violations.length} violation(s):\n`);
    result.violations.forEach((v) => {
      console.log(`  ${v.file}:${v.line}`);
      console.log(`    ${v.message}`);
      console.log(`    ${v.code}\n`);
    });
    console.log('📋 Fix: Follow saga pattern from .prot/pillar-m/saga.ts');
    console.log('   Key requirements:');
    console.log('   1. Define compensation array: const compensations = []');
    console.log('   2. Push compensation BEFORE each step');
    console.log('   3. Pop and execute in catch block (LIFO order)\n');
    process.exit(1);
  }
});

export { audit };
