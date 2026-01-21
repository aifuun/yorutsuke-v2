#!/usr/bin/env node

/**
 * Lambda TypeScript Build Script
 *
 * Compiles all Lambda functions and shared-layer modules from TypeScript to ESM (.mjs)
 * Uses esbuild for fast compilation with minimal configuration.
 *
 * Output: .lambda-dist/ directory (gitignored)
 */

import { build } from 'esbuild';
import { glob } from 'glob';
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const infraRoot = join(__dirname, '..');
const lambdaRoot = join(infraRoot, 'lambda');
const distRoot = join(infraRoot, '.lambda-dist');

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n${colors.bright}[${step}]${colors.reset} ${message}`);
}

async function main() {
  log(`\n${'='.repeat(60)}`, colors.bright);
  log('Lambda TypeScript Build', colors.bright);
  log(`${'='.repeat(60)}\n`, colors.bright);

  try {
    // Step 1: Clean output directory
    logStep('1/4', 'Cleaning output directory...');
    if (existsSync(distRoot)) {
      log(`  Removing ${distRoot}`, colors.yellow);
      await import('fs/promises').then((fs) => fs.rm(distRoot, { recursive: true, force: true }));
    }
    mkdirSync(distRoot, { recursive: true });
    log(`  ✓ Created ${distRoot}`, colors.green);

    // Step 2: Build shared-layer
    logStep('2/4', 'Building shared-layer modules...');
    await buildSharedLayer();

    // Step 3: Build Lambda functions
    logStep('3/4', 'Building Lambda functions...');
    await buildLambdaFunctions();

    // Step 4: Copy package.json for layer
    logStep('4/4', 'Copying package.json for Layer...');
    copyLayerPackageJson();

    log(`\n${'='.repeat(60)}`, colors.bright);
    log('✨ Build completed successfully!', colors.green + colors.bright);
    log(`${'='.repeat(60)}\n`, colors.bright);
  } catch (error) {
    log(`\n${'='.repeat(60)}`, colors.bright);
    log('❌ Build failed!', colors.red + colors.bright);
    log(`${'='.repeat(60)}\n`, colors.bright);
    console.error(error);
    process.exit(1);
  }
}

async function buildSharedLayer() {
  const sharedLayerSrc = join(lambdaRoot, 'shared-layer/nodejs/shared');
  const sharedLayerDist = join(distRoot, 'shared-layer/nodejs/shared');

  // Find all .ts files in shared-layer (exclude tests)
  const tsFiles = glob.sync('**/*.ts', {
    cwd: sharedLayerSrc,
    absolute: false,
    ignore: ['**/*.test.ts', '**/__tests__/**'],
  });

  if (tsFiles.length === 0) {
    log('  ⚠️  No TypeScript files found in shared-layer, skipping...', colors.yellow);
    return;
  }

  log(`  Found ${tsFiles.length} TypeScript files`, colors.blue);

  // Convert to absolute paths for esbuild
  const entryPoints = tsFiles.map((file) => join(sharedLayerSrc, file));

  // Build with esbuild
  await build({
    entryPoints,
    bundle: false, // Don't bundle, preserve module structure
    platform: 'node',
    target: 'node20',
    format: 'esm',
    outdir: sharedLayerDist,
    outExtension: { '.js': '.mjs' },
    logLevel: 'info',
  });

  log(`  ✓ Built ${tsFiles.length} shared-layer modules`, colors.green);
}

async function buildLambdaFunctions() {
  // Find all Lambda function entry points (index.ts or index.mjs)
  const functionDirs = glob.sync('*/index.{ts,mjs}', {
    cwd: lambdaRoot,
    absolute: false,
  });

  // Also check nested admin functions
  const adminFunctions = glob.sync('admin/*/index.{ts,mjs}', {
    cwd: lambdaRoot,
    absolute: false,
  });

  const allFunctions = [...functionDirs, ...adminFunctions];

  if (allFunctions.length === 0) {
    log('  ⚠️  No Lambda functions found, skipping...', colors.yellow);
    return;
  }

  log(`  Found ${allFunctions.length} Lambda functions`, colors.blue);

  // Build each function
  for (const funcPath of allFunctions) {
    const funcName = dirname(funcPath);
    const funcSrc = join(lambdaRoot, funcPath);
    const funcDist = join(distRoot, funcName);

    // Create output directory
    mkdirSync(funcDist, { recursive: true });

    // Check if it's .ts or .mjs
    const isTypeScript = funcPath.endsWith('.ts');

    if (isTypeScript) {
      // Build TypeScript function
      await build({
        entryPoints: [funcSrc],
        bundle: false,
        platform: 'node',
        target: 'node20',
        format: 'esm',
        outdir: funcDist,
        outExtension: { '.js': '.mjs' },
        external: ['/opt/nodejs/*'], // Don't bundle layer code
        logLevel: 'warning',
      });
      log(`  ✓ Built ${funcName} (TypeScript)`, colors.green);
    } else {
      // Copy .mjs file as-is (not yet migrated)
      cpSync(funcSrc, join(funcDist, 'index.mjs'));
      log(`  ✓ Copied ${funcName} (.mjs)`, colors.yellow);
    }
  }

  log(`  ✓ Built ${allFunctions.length} Lambda functions`, colors.green);
}

function copyLayerPackageJson() {
  const layerPackageJson = join(lambdaRoot, 'shared-layer/nodejs/package.json');
  const distPackageJson = join(distRoot, 'shared-layer/nodejs/package.json');

  if (existsSync(layerPackageJson)) {
    mkdirSync(dirname(distPackageJson), { recursive: true });
    cpSync(layerPackageJson, distPackageJson);
    log(`  ✓ Copied package.json to Layer dist`, colors.green);
  } else {
    log(`  ⚠️  No package.json found in shared-layer, skipping...`, colors.yellow);
  }
}

// Run main
main();
