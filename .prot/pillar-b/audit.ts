/**
 * Pillar B Audit: Evolutionary Airlock
 *
 * Checks:
 * - Adapters don't return raw fetch/invoke results
 * - All external data goes through parse functions
 *
 * Run: npx tsx .prot/pillar-b/audit.ts
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

// Patterns that indicate raw data return (violations)
const RAW_RETURN_PATTERNS = [
  // Direct return of fetch response
  /return\s+(?:await\s+)?response\.json\(\)/,
  /return\s+(?:await\s+)?fetch\(/,
  // Direct return of axios/api response
  /return\s+(?:await\s+)?(?:axios|api)\.\w+\([^)]+\)(?:\.data)?;?\s*$/,
  // Direct return of invoke (Tauri IPC)
  /return\s+(?:await\s+)?invoke\s*\(/,
  // Type assertion instead of parsing
  /as\s+\w+(?:\[\])?;?\s*$/,
  // JSON.parse without validation
  /return\s+JSON\.parse\(/,
];

// Patterns that indicate proper airlock usage (allowed)
const AIRLOCK_PATTERNS = [
  // Using parse function
  /parse\w+\s*\(/,
  // Using schema validation
  /\.parse\s*\(/,
  /\.safeParse\s*\(/,
  // Zod validation
  /Schema\.parse/,
];

async function audit(): Promise<AuditResult> {
  const violations: Violation[] = [];

  // Find adapter files
  const patterns = [
    'src/**/adapters/**/*.ts',
    'src/**/api/**/*.ts',
    'src/**/services/**/*Api.ts',
    'src/**/services/**/*Ipc.ts',
    'src/02_modules/**/adapters/**/*.ts',
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

    // Check if file has any parse functions imported or defined
    const hasAirlock = AIRLOCK_PATTERNS.some(pattern => pattern.test(content));

    lines.forEach((line, index) => {
      // Skip comments
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
        return;
      }

      // Skip if line uses airlock
      if (AIRLOCK_PATTERNS.some(pattern => pattern.test(line))) {
        return;
      }

      // Check for violations
      for (const pattern of RAW_RETURN_PATTERNS) {
        if (pattern.test(line)) {
          // Additional context check - look at surrounding lines
          const context = lines.slice(Math.max(0, index - 3), index + 1).join('\n');

          // Skip if parse function is used nearby
          if (AIRLOCK_PATTERNS.some(p => p.test(context))) {
            continue;
          }

          violations.push({
            file,
            line: index + 1,
            message: 'Raw external data returned without airlock validation.',
            code: line.trim(),
          });
          break;
        }
      }
    });

    // Warn if adapter file has no airlock imports
    if (!hasAirlock && files.length > 0) {
      const hasExternalCalls = /fetch\(|invoke\(|axios\.|api\./i.test(content);
      if (hasExternalCalls) {
        violations.push({
          file,
          line: 1,
          message: 'Adapter file makes external calls but has no parse/validation functions.',
          code: '(file-level warning)',
        });
      }
    }
  }

  return {
    success: violations.length === 0,
    violations,
  };
}

// Run audit
audit().then((result) => {
  console.log('\n🔍 Pillar B Audit: Evolutionary Airlock\n');

  if (result.success) {
    console.log('✅ All checks passed - All adapters use airlock validation\n');
  } else {
    console.log(`❌ Found ${result.violations.length} violation(s):\n`);
    result.violations.forEach((v) => {
      console.log(`  ${v.file}:${v.line}`);
      console.log(`    ${v.message}`);
      console.log(`    Code: ${v.code}\n`);
    });
    console.log('📋 Fix: Use parse functions from .prot/pillar-b/airlock.ts');
    console.log('   Example: return parseUser(await response.json())\n');
    process.exit(1);
  }
});

export { audit };
