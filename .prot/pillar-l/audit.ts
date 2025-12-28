/**
 * Pillar L Audit: Headless Abstraction
 *
 * Detects JSX in headless hooks (logic should be separated from UI).
 *
 * Checks:
 * - JSX elements in headless/ files
 * - Render functions (renderXxx)
 * - CSS/styling in headless hooks
 * - DOM manipulation
 *
 * Run: npx tsx .prot/pillar-l/audit.ts
 */

import { glob } from 'glob';
import * as fs from 'fs';

// =============================================================================
// TYPES
// =============================================================================

interface Violation {
  file: string;
  line: number;
  column: number;
  type: 'jsx' | 'render-function' | 'styling' | 'dom-access';
  message: string;
  code: string;
  suggestion: string;
}

interface AuditResult {
  success: boolean;
  violations: Violation[];
  summary: {
    filesScanned: number;
    jsxViolations: number;
    renderFunctions: number;
    stylingViolations: number;
    domAccessViolations: number;
  };
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  // Directories containing headless hooks
  headlessPatterns: [
    'src/**/headless/**/*.ts',
    'src/**/headless/**/*.tsx', // Should not exist, but check anyway
  ],

  // Files to ignore
  ignorePatterns: [
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.spec.ts',
    '**/node_modules/**',
    '**/.prot/**',
  ],
};

// =============================================================================
// DETECTION PATTERNS
// =============================================================================

// JSX patterns
const JSX_PATTERNS = [
  // Self-closing tags: <Component />
  { pattern: /<[A-Z][a-zA-Z0-9]*\s*\/>/g, name: 'Self-closing JSX component' },
  // Opening tags: <Component> or <Component prop="value">
  { pattern: /<[A-Z][a-zA-Z0-9]*[\s>]/g, name: 'JSX component' },
  // HTML tags: <div>, <span>, etc.
  { pattern: /<(div|span|p|h[1-6]|button|input|form|ul|li|a|img)[\s>\/]/g, name: 'HTML element' },
  // Closing tags: </Component> or </div>
  { pattern: /<\/[A-Za-z][a-zA-Z0-9]*>/g, name: 'Closing tag' },
  // React fragments: <> or </>
  { pattern: /<>|<\/>/g, name: 'React fragment' },
];

// Render function patterns
const RENDER_FUNCTION_PATTERNS = [
  // render* functions
  { pattern: /\brender[A-Z][a-zA-Z]*\s*[=:]\s*\(/g, name: 'Render function definition' },
  { pattern: /\brender[A-Z][a-zA-Z]*\s*\(\)/g, name: 'Render function call' },
  // Returning JSX
  { pattern: /return\s*\(/g, name: 'Possible JSX return' }, // Will be checked with JSX patterns
];

// Styling patterns (should not be in headless)
const STYLING_PATTERNS = [
  { pattern: /className\s*[=:]/g, name: 'className usage' },
  { pattern: /style\s*[=:]\s*\{/g, name: 'inline style' },
  { pattern: /import.*\.css['"]/g, name: 'CSS import' },
  { pattern: /import.*\.scss['"]/g, name: 'SCSS import' },
  { pattern: /import.*\.module\./g, name: 'CSS module import' },
  { pattern: /styled\./g, name: 'styled-components' },
];

// DOM access patterns
const DOM_PATTERNS = [
  { pattern: /document\.(getElementById|querySelector|querySelectorAll|createElement)/g, name: 'DOM query' },
  { pattern: /document\.(body|head|documentElement)/g, name: 'DOM access' },
  { pattern: /window\.(location|history|localStorage|sessionStorage)/g, name: 'Window access' },
  { pattern: /\.innerHTML\s*=/g, name: 'innerHTML manipulation' },
  { pattern: /\.appendChild\s*\(/g, name: 'DOM manipulation' },
];

// =============================================================================
// AUDIT FUNCTIONS
// =============================================================================

function isInComment(line: string, matchIndex: number): boolean {
  // Check if match is inside a comment
  const beforeMatch = line.substring(0, matchIndex);
  return beforeMatch.includes('//') || beforeMatch.includes('/*');
}

function isInString(line: string, matchIndex: number): boolean {
  // Simple check - count quotes before match
  const beforeMatch = line.substring(0, matchIndex);
  const singleQuotes = (beforeMatch.match(/'/g) || []).length;
  const doubleQuotes = (beforeMatch.match(/"/g) || []).length;
  const backticks = (beforeMatch.match(/`/g) || []).length;

  // If odd number of any quote type, we're inside a string
  return singleQuotes % 2 === 1 || doubleQuotes % 2 === 1 || backticks % 2 === 1;
}

async function scanFile(filePath: string): Promise<Violation[]> {
  const violations: Violation[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    // Check JSX patterns
    for (const { pattern, name } of JSX_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(line)) !== null) {
        if (!isInComment(line, match.index) && !isInString(line, match.index)) {
          violations.push({
            file: filePath,
            line: lineNumber,
            column: match.index,
            type: 'jsx',
            message: `JSX detected: ${name}`,
            code: match[0],
            suggestion: 'Return data/functions instead. Move JSX to view component.',
          });
        }
      }
    }

    // Check render function patterns
    for (const { pattern, name } of RENDER_FUNCTION_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(line)) !== null) {
        if (!isInComment(line, match.index) && !isInString(line, match.index)) {
          // Skip 'return (' if no JSX found on same line
          if (name === 'Possible JSX return' && !JSX_PATTERNS.some(p => p.pattern.test(line))) {
            continue;
          }
          violations.push({
            file: filePath,
            line: lineNumber,
            column: match.index,
            type: 'render-function',
            message: `Render function detected: ${name}`,
            code: match[0],
            suggestion: 'Headless hooks should not have render functions. Move to view.',
          });
        }
      }
    }

    // Check styling patterns
    for (const { pattern, name } of STYLING_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(line)) !== null) {
        if (!isInComment(line, match.index) && !isInString(line, match.index)) {
          violations.push({
            file: filePath,
            line: lineNumber,
            column: match.index,
            type: 'styling',
            message: `Styling in headless: ${name}`,
            code: match[0],
            suggestion: 'Styling is a view concern. Move to view component.',
          });
        }
      }
    }

    // Check DOM patterns
    for (const { pattern, name } of DOM_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(line)) !== null) {
        if (!isInComment(line, match.index) && !isInString(line, match.index)) {
          violations.push({
            file: filePath,
            line: lineNumber,
            column: match.index,
            type: 'dom-access',
            message: `DOM access in headless: ${name}`,
            code: match[0],
            suggestion: 'Headless hooks should not access DOM directly.',
          });
        }
      }
    }
  });

  // Deduplicate violations on same line
  const unique = violations.filter((v, i, arr) =>
    arr.findIndex(x => x.file === v.file && x.line === v.line && x.type === v.type) === i
  );

  return unique;
}

// =============================================================================
// MAIN AUDIT
// =============================================================================

async function audit(): Promise<AuditResult> {
  const violations: Violation[] = [];
  let filesScanned = 0;

  // Find all headless files
  const files = await glob(CONFIG.headlessPatterns, {
    ignore: CONFIG.ignorePatterns,
  });

  // Scan each file
  for (const file of files) {
    filesScanned++;
    const fileViolations = await scanFile(file);
    violations.push(...fileViolations);
  }

  // Calculate summary
  const summary = {
    filesScanned,
    jsxViolations: violations.filter(v => v.type === 'jsx').length,
    renderFunctions: violations.filter(v => v.type === 'render-function').length,
    stylingViolations: violations.filter(v => v.type === 'styling').length,
    domAccessViolations: violations.filter(v => v.type === 'dom-access').length,
  };

  return {
    success: violations.length === 0,
    violations,
    summary,
  };
}

// =============================================================================
// OUTPUT
// =============================================================================

function formatViolation(v: Violation): string {
  return `  ${v.file}:${v.line}:${v.column}
    ❌ ${v.message}
    📝 Code: ${v.code}
    💡 ${v.suggestion}`;
}

async function main() {
  console.log('🔍 Pillar L Audit: Headless Abstraction\n');

  const result = await audit();

  if (result.summary.filesScanned === 0) {
    console.log('ℹ️  No headless files found to scan.');
    console.log('   Expected location: src/**/headless/**/*.ts\n');
    return;
  }

  if (result.success) {
    console.log('✅ All checks passed!\n');
    console.log(`   Files scanned: ${result.summary.filesScanned}`);
    console.log('   No JSX or render functions found in headless hooks.');
  } else {
    console.log('❌ Violations found:\n');

    // Group by type
    const byType = {
      jsx: result.violations.filter(v => v.type === 'jsx'),
      'render-function': result.violations.filter(v => v.type === 'render-function'),
      styling: result.violations.filter(v => v.type === 'styling'),
      'dom-access': result.violations.filter(v => v.type === 'dom-access'),
    };

    if (byType.jsx.length > 0) {
      console.log(`\n🏷️  JSX in Headless (${byType.jsx.length}):\n`);
      byType.jsx.forEach(v => console.log(formatViolation(v)));
    }

    if (byType['render-function'].length > 0) {
      console.log(`\n🎨 Render Functions (${byType['render-function'].length}):\n`);
      byType['render-function'].forEach(v => console.log(formatViolation(v)));
    }

    if (byType.styling.length > 0) {
      console.log(`\n🎭 Styling in Headless (${byType.styling.length}):\n`);
      byType.styling.forEach(v => console.log(formatViolation(v)));
    }

    if (byType['dom-access'].length > 0) {
      console.log(`\n📄 DOM Access (${byType['dom-access'].length}):\n`);
      byType['dom-access'].forEach(v => console.log(formatViolation(v)));
    }

    console.log('\n📊 Summary:');
    console.log(`   Files scanned: ${result.summary.filesScanned}`);
    console.log(`   JSX violations: ${result.summary.jsxViolations}`);
    console.log(`   Render functions: ${result.summary.renderFunctions}`);
    console.log(`   Styling violations: ${result.summary.stylingViolations}`);
    console.log(`   DOM access: ${result.summary.domAccessViolations}`);

    process.exit(1);
  }
}

// Run if executed directly
main().catch(console.error);

export { audit, AuditResult, Violation };
