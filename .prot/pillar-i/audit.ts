/**
 * Pillar I Audit: Architectural Firewalls
 *
 * Detects imports that violate module boundaries and layer hierarchy.
 *
 * Checks:
 * - Layer violations (kernel cannot import domains/modules, domains cannot import modules)
 * - Deep imports into module internals (headless/, adapters/, views/, workflows/)
 * - Excessive relative imports (../../..)
 * - Missing index.ts in modules
 * - Barrel exports exposing internals
 *
 * Layer Hierarchy:
 *   00_kernel (L0) → Cannot import L1, L2
 *   01_domains (L1) → Cannot import L2
 *   02_modules (L2) → Can import L0, L1
 *
 * Run: npx tsx .prot/pillar-i/audit.ts
 */

import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// TYPES
// =============================================================================

interface Violation {
  file: string;
  line: number;
  column: number;
  type: 'deep-import' | 'relative-deep' | 'missing-index' | 'barrel-export' | 'layer-violation';
  message: string;
  suggestion: string;
}

interface AuditResult {
  success: boolean;
  violations: Violation[];
  summary: {
    filesScanned: number;
    deepImports: number;
    relativeDeep: number;
    missingIndex: number;
    barrelExports: number;
    layerViolations: number;
  };
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  // Directories to scan
  srcDir: 'src',
  modulesDir: 'src/02_modules',

  // Internal directories that should not be imported directly
  internalDirs: ['headless', 'adapters', 'views', 'workflows', 'internal', 'utils'],

  // Files to scan
  filePatterns: ['**/*.ts', '**/*.tsx'],

  // Files to ignore
  ignorePatterns: [
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.spec.ts',
    '**/*.spec.tsx',
    '**/node_modules/**',
    '**/.prot/**',
  ],

  // Maximum allowed relative depth before warning
  maxRelativeDepth: 2,

  // Layer hierarchy (lower number = lower layer, cannot import higher layers)
  layers: {
    '00_kernel': 0,
    '01_domains': 1,
    '02_modules': 2,
  } as Record<string, number>,
};

// =============================================================================
// PATTERNS
// =============================================================================

// Pattern: import from '@/modules/xxx/internal/...'
const DEEP_IMPORT_PATTERN = new RegExp(
  `from\\s+['"]@/modules/\\w+/(${CONFIG.internalDirs.join('|')})/`,
  'g'
);

// Pattern: import from '../../module/internal/...'
const RELATIVE_DEEP_PATTERN = new RegExp(
  `from\\s+['"][.]{2}/.*/(${CONFIG.internalDirs.join('|')})/`,
  'g'
);

// Pattern: Excessive relative imports (../../../..)
const EXCESSIVE_RELATIVE_PATTERN = /from\s+['"]([.]{2}\/){3,}/g;

// Pattern: Barrel exports (export * from './internal')
const BARREL_EXPORT_PATTERN = new RegExp(
  `export\\s+\\*\\s+from\\s+['"]./(${CONFIG.internalDirs.join('|')})['"]`,
  'g'
);

// Pattern: Import from layer directories (captures layer name)
const LAYER_IMPORT_PATTERN = /from\s+['"]@\/(0[0-2]_\w+)/g;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get the layer of a file based on its path
 */
function getFileLayer(filePath: string): { name: string; level: number } | null {
  for (const [layerName, level] of Object.entries(CONFIG.layers)) {
    if (filePath.includes(`/${layerName}/`) || filePath.includes(`\\${layerName}\\`)) {
      return { name: layerName, level };
    }
  }
  return null;
}

/**
 * Get the layer level from a layer name
 */
function getLayerLevel(layerName: string): number | null {
  return CONFIG.layers[layerName] ?? null;
}

// =============================================================================
// AUDIT FUNCTIONS
// =============================================================================

async function scanFile(filePath: string): Promise<Violation[]> {
  const violations: Violation[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    // Check deep imports via path alias
    let match;
    DEEP_IMPORT_PATTERN.lastIndex = 0;
    while ((match = DEEP_IMPORT_PATTERN.exec(line)) !== null) {
      violations.push({
        file: filePath,
        line: lineNumber,
        column: match.index,
        type: 'deep-import',
        message: `Deep import into module internals: ${match[0]}`,
        suggestion: `Import from module root: @/modules/{module}`,
      });
    }

    // Check relative deep imports
    RELATIVE_DEEP_PATTERN.lastIndex = 0;
    while ((match = RELATIVE_DEEP_PATTERN.exec(line)) !== null) {
      violations.push({
        file: filePath,
        line: lineNumber,
        column: match.index,
        type: 'relative-deep',
        message: `Relative import into internal directory: ${match[0]}`,
        suggestion: `Use path alias: @/modules/{module}`,
      });
    }

    // Check excessive relative imports
    EXCESSIVE_RELATIVE_PATTERN.lastIndex = 0;
    while ((match = EXCESSIVE_RELATIVE_PATTERN.exec(line)) !== null) {
      violations.push({
        file: filePath,
        line: lineNumber,
        column: match.index,
        type: 'relative-deep',
        message: `Excessive relative import depth: ${match[0]}`,
        suggestion: `Use path aliases instead of deep relative imports`,
      });
    }

    // Check barrel exports (only in index.ts files)
    if (filePath.endsWith('index.ts')) {
      BARREL_EXPORT_PATTERN.lastIndex = 0;
      while ((match = BARREL_EXPORT_PATTERN.exec(line)) !== null) {
        violations.push({
          file: filePath,
          line: lineNumber,
          column: match.index,
          type: 'barrel-export',
          message: `Barrel export exposes internals: ${match[0]}`,
          suggestion: `Use explicit exports: export { specific } from './${match[1]}/file'`,
        });
      }
    }

    // Check layer violations (lower layers cannot import higher layers)
    const fileLayer = getFileLayer(filePath);
    if (fileLayer) {
      LAYER_IMPORT_PATTERN.lastIndex = 0;
      while ((match = LAYER_IMPORT_PATTERN.exec(line)) !== null) {
        const importedLayer = match[1];
        const importedLevel = getLayerLevel(importedLayer);

        if (importedLevel !== null && importedLevel > fileLayer.level) {
          violations.push({
            file: filePath,
            line: lineNumber,
            column: match.index,
            type: 'layer-violation',
            message: `Layer violation: ${fileLayer.name} (L${fileLayer.level}) imports ${importedLayer} (L${importedLevel})`,
            suggestion: `Lower layers cannot import higher layers. Move shared code to ${fileLayer.name} or lower.`,
          });
        }
      }
    }
  });

  return violations;
}

async function checkMissingIndexFiles(): Promise<Violation[]> {
  const violations: Violation[] = [];

  // Check if modules directory exists
  if (!fs.existsSync(CONFIG.modulesDir)) {
    return violations;
  }

  // Get all module directories
  const modules = fs.readdirSync(CONFIG.modulesDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  for (const module of modules) {
    const indexPath = path.join(CONFIG.modulesDir, module, 'index.ts');
    if (!fs.existsSync(indexPath)) {
      violations.push({
        file: path.join(CONFIG.modulesDir, module),
        line: 0,
        column: 0,
        type: 'missing-index',
        message: `Module "${module}" is missing index.ts`,
        suggestion: `Create ${indexPath} with public API exports`,
      });
    }
  }

  return violations;
}

// =============================================================================
// MAIN AUDIT
// =============================================================================

async function audit(): Promise<AuditResult> {
  const violations: Violation[] = [];
  let filesScanned = 0;

  // Find all TypeScript files
  const files = await glob(CONFIG.filePatterns.map(p => `${CONFIG.srcDir}/${p}`), {
    ignore: CONFIG.ignorePatterns,
  });

  // Scan each file
  for (const file of files) {
    filesScanned++;
    const fileViolations = await scanFile(file);
    violations.push(...fileViolations);
  }

  // Check for missing index files
  const missingIndexViolations = await checkMissingIndexFiles();
  violations.push(...missingIndexViolations);

  // Calculate summary
  const summary = {
    filesScanned,
    deepImports: violations.filter(v => v.type === 'deep-import').length,
    relativeDeep: violations.filter(v => v.type === 'relative-deep').length,
    missingIndex: violations.filter(v => v.type === 'missing-index').length,
    barrelExports: violations.filter(v => v.type === 'barrel-export').length,
    layerViolations: violations.filter(v => v.type === 'layer-violation').length,
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
  const location = v.line > 0 ? `${v.file}:${v.line}:${v.column}` : v.file;
  return `  ${location}\n    ❌ ${v.message}\n    💡 ${v.suggestion}`;
}

async function main() {
  console.log('🔍 Pillar I Audit: Architectural Firewalls\n');

  const result = await audit();

  if (result.success) {
    console.log('✅ All checks passed!\n');
    console.log(`   Files scanned: ${result.summary.filesScanned}`);
  } else {
    console.log('❌ Violations found:\n');

    // Group by type
    const byType = {
      'deep-import': result.violations.filter(v => v.type === 'deep-import'),
      'relative-deep': result.violations.filter(v => v.type === 'relative-deep'),
      'missing-index': result.violations.filter(v => v.type === 'missing-index'),
      'barrel-export': result.violations.filter(v => v.type === 'barrel-export'),
      'layer-violation': result.violations.filter(v => v.type === 'layer-violation'),
    };

    if (byType['layer-violation'].length > 0) {
      console.log(`\n🔺 Layer Violations (${byType['layer-violation'].length}):\n`);
      byType['layer-violation'].forEach(v => console.log(formatViolation(v)));
    }

    if (byType['deep-import'].length > 0) {
      console.log(`\n📦 Deep Imports (${byType['deep-import'].length}):\n`);
      byType['deep-import'].forEach(v => console.log(formatViolation(v)));
    }

    if (byType['relative-deep'].length > 0) {
      console.log(`\n🔗 Relative Deep Imports (${byType['relative-deep'].length}):\n`);
      byType['relative-deep'].forEach(v => console.log(formatViolation(v)));
    }

    if (byType['missing-index'].length > 0) {
      console.log(`\n📄 Missing index.ts (${byType['missing-index'].length}):\n`);
      byType['missing-index'].forEach(v => console.log(formatViolation(v)));
    }

    if (byType['barrel-export'].length > 0) {
      console.log(`\n📤 Barrel Exports (${byType['barrel-export'].length}):\n`);
      byType['barrel-export'].forEach(v => console.log(formatViolation(v)));
    }

    console.log('\n📊 Summary:');
    console.log(`   Files scanned: ${result.summary.filesScanned}`);
    console.log(`   Layer violations: ${result.summary.layerViolations}`);
    console.log(`   Deep imports: ${result.summary.deepImports}`);
    console.log(`   Relative deep: ${result.summary.relativeDeep}`);
    console.log(`   Missing index: ${result.summary.missingIndex}`);
    console.log(`   Barrel exports: ${result.summary.barrelExports}`);

    process.exit(1);
  }
}

// Run if executed directly
main().catch(console.error);

export { audit, AuditResult, Violation };
