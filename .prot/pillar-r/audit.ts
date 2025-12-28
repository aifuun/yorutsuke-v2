/**
 * Pillar R Audit: Semantic Observability
 *
 * Checks:
 * - No console.log/warn/error in production code
 * - Logs should use structured logger (logger.info, logger.error, etc.)
 * - Log events should be semantic (NOUN_VERB format)
 *
 * Run: npx tsx .prot/pillar-r/audit.ts
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

// Anti-patterns: console.* usage
const CONSOLE_PATTERNS = [
  /console\.(log|warn|error|info|debug)\s*\(/,
];

// Allowed patterns (exceptions)
const ALLOWED_PATTERNS = [
  // Explicit exception marker
  /\/\/\s*LOG-EXCEPTION:/,
  // In logger implementation itself
  /console\.(log|warn|error)\s*\(\s*JSON\.stringify/,
  // Scripts and CLI tools
  /bin\//,
  /scripts\//,
  /cli\//,
];

// Proper structured logging patterns
const STRUCTURED_LOG_PATTERNS = [
  /logger\.(debug|info|warn|error|critical)\s*\(\s*['"`][A-Z_]+['"`]/,
  /log\.(debug|info|warn|error|critical)\s*\(\s*['"`][A-Z_]+['"`]/,
];

// Non-semantic log patterns (bad)
const NON_SEMANTIC_PATTERNS = [
  // String concatenation in logs
  /logger\.\w+\s*\(\s*['"`][^'"]+['"`]\s*\+/,
  // Template literals with prose
  /logger\.\w+\s*\(\s*`[^`]*\$\{/,
  // Lowercase event names
  /logger\.\w+\s*\(\s*['"`][a-z]/,
];

const CHECK_PATTERNS = [
  'src/**/*.ts',
  'src/**/*.tsx',
];

const IGNORE_PATTERNS = [
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/node_modules/**',
  '**/*.d.ts',
  '**/scripts/**',
  '**/bin/**',
  '**/cli/**',
  // Logger implementation files are allowed to use console
  '**/logger.ts',
  '**/logging.ts',
  '**/observability.ts',
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

    lines.forEach((line, index) => {
      // Skip comments
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
        return;
      }

      // Skip allowed patterns
      if (ALLOWED_PATTERNS.some(pattern => pattern.test(line) || pattern.test(file))) {
        return;
      }

      // Check for console.* usage
      for (const pattern of CONSOLE_PATTERNS) {
        if (pattern.test(line)) {
          violations.push({
            file,
            line: index + 1,
            message: 'console.* detected. Use structured logger instead.',
            code: line.trim(),
          });
          break;
        }
      }

      // Check for non-semantic logging
      for (const pattern of NON_SEMANTIC_PATTERNS) {
        if (pattern.test(line)) {
          warnings.push({
            file,
            line: index + 1,
            message: 'Non-semantic log format. Use NOUN_VERB event names.',
            code: line.trim(),
          });
          break;
        }
      }
    });

    // Check if file has any logging but no traceId
    const hasLogging = STRUCTURED_LOG_PATTERNS.some(p => p.test(content));
    const hasTraceId = /traceId/.test(content);

    if (hasLogging && !hasTraceId) {
      warnings.push({
        file,
        line: 1,
        message: 'File has logging but no traceId reference. Consider adding trace context.',
        code: 'Expected: { traceId: ctx.traceId, ... }',
      });
    }
  }

  return {
    success: violations.length === 0,
    violations,
    warnings,
  };
}

// Run audit
audit().then((result) => {
  console.log('\n🔍 Pillar R Audit: Semantic Observability\n');

  if (result.warnings.length > 0) {
    console.log(`⚠️  ${result.warnings.length} warning(s):\n`);
    result.warnings.forEach((w) => {
      console.log(`  ${w.file}:${w.line}`);
      console.log(`    ${w.message}`);
      console.log(`    ${w.code}\n`);
    });
  }

  if (result.success) {
    console.log('✅ All checks passed - No console.* usage in production code\n');
  } else {
    console.log(`❌ Found ${result.violations.length} violation(s):\n`);
    result.violations.forEach((v) => {
      console.log(`  ${v.file}:${v.line}`);
      console.log(`    ${v.message}`);
      console.log(`    Code: ${v.code}\n`);
    });
    console.log('📋 Fix: Use structured logger from .prot/pillar-r/observability.ts');
    console.log('   Example:');
    console.log("   logger.info('ORDER_CREATED', {");
    console.log('     traceId: ctx.traceId,');
    console.log('     orderId: order.id,');
    console.log('     status: order.status,');
    console.log('   });\n');
    process.exit(1);
  }
});

export { audit };
