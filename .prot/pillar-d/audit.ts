/**
 * Pillar D Audit: Explicit FSM
 *
 * Checks:
 * - No multiple boolean useState flags (isLoading, isError, etc.)
 * - State should use discriminated unions with 'status' field
 *
 * Run: npx tsx .prot/pillar-d/audit.ts
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

// Patterns that indicate boolean flag anti-patterns
const BOOLEAN_FLAG_PATTERNS = [
  // useState with boolean initial value for loading/error states
  /useState\s*<?\s*boolean\s*>?\s*\(\s*(false|true)\s*\)/,
  // Common boolean state names
  /const\s*\[\s*(isLoading|isError|isSuccess|isFetching|isSubmitting|isPending|isOpen|isVisible|isActive|isDisabled|isValid|isInvalid)\s*,/i,
  // Multiple useState booleans in sequence (detect pattern)
  /useState\(false\).*useState\(false\)/s,
];

// Patterns that indicate acceptable usage
const ALLOWED_PATTERNS = [
  // Simple modal/toggle (acceptable)
  /const\s*\[\s*isOpen\s*,\s*setIsOpen\s*\]\s*=\s*useState\s*\(\s*false\s*\)/,
  // Test files
  /\.test\.|\.spec\./,
  // Comments explaining exception
  /\/\/\s*FSM-EXCEPTION:/,
];

// Files/patterns to check
const CHECK_PATTERNS = [
  'src/**/headless/**/*.ts',
  'src/**/headless/**/*.tsx',
  'src/**/hooks/**/*.ts',
  'src/**/hooks/**/*.tsx',
  'src/02_modules/**/*.ts',
  'src/02_modules/**/*.tsx',
];

const IGNORE_PATTERNS = [
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/node_modules/**',
  '**/*.d.ts',
];

async function audit(): Promise<AuditResult> {
  const violations: Violation[] = [];

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

    // Track boolean useStates in file
    const booleanStates: { name: string; line: number }[] = [];

    lines.forEach((line, index) => {
      // Skip comments
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
        return;
      }

      // Skip allowed patterns
      if (ALLOWED_PATTERNS.some(pattern => pattern.test(line))) {
        return;
      }

      // Check for boolean useState patterns
      const stateMatch = line.match(/const\s*\[\s*(is\w+)\s*,\s*set\w+\s*\]\s*=\s*useState/i);
      if (stateMatch) {
        booleanStates.push({ name: stateMatch[1], line: index + 1 });
      }

      // Detect explicit boolean flag violations
      for (const pattern of BOOLEAN_FLAG_PATTERNS) {
        if (pattern.test(line)) {
          // Skip if it's a simple isOpen for modals
          if (/isOpen|isVisible/.test(line) && booleanStates.length <= 1) {
            continue;
          }

          violations.push({
            file,
            line: index + 1,
            message: 'Boolean flag state detected. Use discriminated union (FSM) instead.',
            code: line.trim(),
          });
          break;
        }
      }
    });

    // Check for multiple boolean states in same file (flag soup)
    const loadingErrorStates = booleanStates.filter(s =>
      /loading|error|success|fetching|submitting|pending/i.test(s.name)
    );

    if (loadingErrorStates.length >= 2) {
      violations.push({
        file,
        line: loadingErrorStates[0].line,
        message: `Multiple boolean flags detected: ${loadingErrorStates.map(s => s.name).join(', ')}. Use FSM pattern instead.`,
        code: `Found ${loadingErrorStates.length} boolean state flags`,
      });
    }
  }

  return {
    success: violations.length === 0,
    violations,
  };
}

// Run audit
audit().then((result) => {
  console.log('\n🔍 Pillar D Audit: Explicit FSM\n');

  if (result.success) {
    console.log('✅ All checks passed - No boolean flag anti-patterns found\n');
  } else {
    console.log(`❌ Found ${result.violations.length} violation(s):\n`);
    result.violations.forEach((v) => {
      console.log(`  ${v.file}:${v.line}`);
      console.log(`    ${v.message}`);
      console.log(`    Code: ${v.code}\n`);
    });
    console.log('📋 Fix: Use discriminated union from .prot/pillar-d/fsm-reducer.ts');
    console.log('   Example:');
    console.log('   type State = ');
    console.log("     | { status: 'idle' }");
    console.log("     | { status: 'loading' }");
    console.log("     | { status: 'success'; data: T }");
    console.log("     | { status: 'error'; error: string };\n");
    process.exit(1);
  }
});

export { audit };
