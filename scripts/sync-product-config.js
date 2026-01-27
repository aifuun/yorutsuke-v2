#!/usr/bin/env node

/**
 * Sync product configuration to tauri.conf.json
 *
 * Usage:
 *   node scripts/sync-product-config.js [env]
 *
 * Examples:
 *   node scripts/sync-product-config.js           # Use production config
 *   node scripts/sync-product-config.js dev       # Use dev config
 *   node scripts/sync-product-config.js staging   # Use staging config
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const productConfigPath = path.join(projectRoot, 'product.config.json');
const tauriConfigPath = path.join(projectRoot, 'app/src-tauri/tauri.conf.json');
const cargoTomlPath = path.join(projectRoot, 'app/src-tauri/Cargo.toml');
const appPackagePath = path.join(projectRoot, 'app/package.json');

// Read environment from CLI argument or NODE_ENV
const env = process.argv[2] || process.env.NODE_ENV || 'production';

console.log(`🔧 Syncing product config for environment: ${env}`);

// Read product configuration
if (!fs.existsSync(productConfigPath)) {
  console.error(`❌ Error: product.config.json not found at ${productConfigPath}`);
  process.exit(1);
}

const productConfig = JSON.parse(fs.readFileSync(productConfigPath, 'utf8'));

// Derive all technical names from single technicalName field
const technicalName = productConfig.technicalName || 'recie';
const derivedConfig = {
  // Database
  databaseName: `${technicalName}.db`,
  databaseNameMock: `${technicalName}-mock.db`,

  // Storage & Logging
  localStoragePrefix: technicalName,
  logDirectory: `.${technicalName}`,

  // Build artifacts (using neutral name)
  rustLibName: 'app_lib',

  // AWS resources
  stackNamePrefix: productConfig.productName.replace(/\s+/g, '') + '2', // "Recie2", "MyApp2"
  resourcePrefix: technicalName,
};

// Determine which config to use
let activeConfig = {
  productName: productConfig.productName,
  identifier: productConfig.identifier,
  version: productConfig.version,
};

// Override with environment-specific config if exists
if (productConfig.environments && productConfig.environments[env]) {
  activeConfig = {
    ...activeConfig,
    ...productConfig.environments[env],
  };
}

console.log(`\n📦 Source Configuration:`);
console.log(`   Product Name: ${activeConfig.productName}`);
console.log(`   Technical Name: ${technicalName}`);
console.log(`   Identifier: ${activeConfig.identifier}`);
console.log(`   Version: ${activeConfig.version}`);

console.log(`\n🔄 Derived Configuration (from technicalName: "${technicalName}"):`);
console.log(`   Database: ${derivedConfig.databaseName}, ${derivedConfig.databaseNameMock}`);
console.log(`   Storage Prefix: ${derivedConfig.localStoragePrefix}`);
console.log(`   Log Directory: ${derivedConfig.logDirectory}`);
console.log(`   Rust Lib: ${derivedConfig.rustLibName}`);
console.log(`   AWS Stack: ${derivedConfig.stackNamePrefix}Stack-${env}`);
console.log(`   AWS Resources: ${derivedConfig.resourcePrefix}-*`);

// Read existing tauri.conf.json
if (!fs.existsSync(tauriConfigPath)) {
  console.error(`❌ Error: tauri.conf.json not found at ${tauriConfigPath}`);
  process.exit(1);
}

const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'));

// Update tauri.conf.json with product config
tauriConfig.productName = activeConfig.productName;
tauriConfig.identifier = activeConfig.identifier;
tauriConfig.version = activeConfig.version;

// Update window title if configured
if (productConfig.window && productConfig.window.title) {
  tauriConfig.app.windows[0].title = activeConfig.productName;
}

// Write updated tauri.conf.json
fs.writeFileSync(tauriConfigPath, JSON.stringify(tauriConfig, null, 2) + '\n');
console.log(`✅ Successfully updated ${tauriConfigPath}`);

// Update Cargo.toml
if (fs.existsSync(cargoTomlPath)) {
  let cargoContent = fs.readFileSync(cargoTomlPath, 'utf8');

  // Update package name (use base productName, lowercase with hyphens for Rust)
  // Remove environment suffix like " (Dev)" or " (Staging)"
  const baseName = productConfig.productName.replace(/\s*\(.*?\)\s*/g, '');
  const cargoPackageName = baseName.toLowerCase().replace(/\s+/g, '-');
  cargoContent = cargoContent.replace(
    /^name = ".*"$/m,
    `name = "${cargoPackageName}"`
  );

  // Update description
  if (productConfig.description) {
    cargoContent = cargoContent.replace(
      /^description = ".*"$/m,
      `description = "${productConfig.description}"`
    );
  }

  // Update version
  cargoContent = cargoContent.replace(
    /^version = ".*"$/m,
    `version = "${activeConfig.version}"`
  );

  fs.writeFileSync(cargoTomlPath, cargoContent);
  console.log(`✅ Successfully updated ${cargoTomlPath}`);
}

// Update app/package.json
if (fs.existsSync(appPackagePath)) {
  const appPackage = JSON.parse(fs.readFileSync(appPackagePath, 'utf8'));

  // Update name (use base productName, lowercase with hyphens for npm)
  // Remove environment suffix like " (Dev)" or " (Staging)"
  const baseName = productConfig.productName.replace(/\s*\(.*?\)\s*/g, '');
  const npmPackageName = baseName.toLowerCase().replace(/\s+/g, '-') + '-app';
  appPackage.name = npmPackageName;
  appPackage.version = activeConfig.version;

  if (productConfig.description) {
    appPackage.description = productConfig.description;
  }

  fs.writeFileSync(appPackagePath, JSON.stringify(appPackage, null, 2) + '\n');
  console.log(`✅ Successfully updated ${appPackagePath}`);
}

// Update i18n translation files
const i18nDir = path.join(projectRoot, 'app/src/i18n/locales');
const locales = ['en', 'ja', 'zh'];

for (const locale of locales) {
  const localePath = path.join(i18nDir, `${locale}.json`);
  if (fs.existsSync(localePath)) {
    const localeData = JSON.parse(fs.readFileSync(localePath, 'utf8'));

    // Update app.name based on locale
    if (!localeData.app) {
      localeData.app = {};
    }

    // Use locale-specific product name if available
    if (locale === 'ja' && productConfig.productNameJa) {
      localeData.app.name = productConfig.productNameJa;
    } else {
      // Use base product name (without environment suffix)
      const baseName = productConfig.productName.replace(/\s*\(.*?\)\s*/g, '');
      localeData.app.name = baseName;
    }

    fs.writeFileSync(localePath, JSON.stringify(localeData, null, 2) + '\n');
    console.log(`✅ Successfully updated ${localePath}`);
  }
}

console.log(`📁 App data directory will be: ~/Library/Application Support/${activeConfig.identifier}/`);

// Generate frontend technical config
const frontendConfigDir = path.join(projectRoot, 'app/src/generated');
const frontendConfigPath = path.join(frontendConfigDir, 'config.ts');

if (!fs.existsSync(frontendConfigDir)) {
  fs.mkdirSync(frontendConfigDir, { recursive: true });
}

const frontendConfigContent = `/**
 * Auto-generated configuration file
 * DO NOT EDIT MANUALLY - Generated by scripts/sync-product-config.js
 *
 * Source: product.config.json (technicalName: "${technicalName}")
 * Generated: ${new Date().toISOString()}
 * Environment: ${env}
 */

// Database configuration
export const DB_PRODUCTION = 'sqlite:${derivedConfig.databaseName}';
export const DB_MOCK = 'sqlite:${derivedConfig.databaseNameMock}';

// LocalStorage keys
export const STORAGE_PREFIX = '${derivedConfig.localStoragePrefix}';
export const QUOTA_STORAGE_KEY = \`\${STORAGE_PREFIX}:quota\`;

// Logging configuration
export const LOG_DIRECTORY = '${derivedConfig.logDirectory}';

// Product information
export const PRODUCT_NAME = '${activeConfig.productName}';
export const PRODUCT_VERSION = '${activeConfig.version}';
export const PRODUCT_IDENTIFIER = '${activeConfig.identifier}';
`;

fs.writeFileSync(frontendConfigPath, frontendConfigContent);
console.log(`✅ Successfully generated ${frontendConfigPath}`);

// Generate infrastructure AWS config
const infraConfigDir = path.join(projectRoot, 'infra/lib/generated');
const infraConfigPath = path.join(infraConfigDir, 'config.ts');

if (!fs.existsSync(infraConfigDir)) {
  fs.mkdirSync(infraConfigDir, { recursive: true });
}

const infraConfigContent = `/**
 * Auto-generated AWS resource configuration
 * DO NOT EDIT MANUALLY - Generated by scripts/sync-product-config.js
 *
 * Source: product.config.json (technicalName: "${technicalName}")
 * Generated: ${new Date().toISOString()}
 * Environment: ${env}
 */

// Stack naming
export const STACK_NAME_PREFIX = '${derivedConfig.stackNamePrefix}';
export const RESOURCE_PREFIX = '${derivedConfig.resourcePrefix}';

// Helper functions for consistent naming
export function getStackName(env: string, stackType: 'main' | 'admin' = 'main'): string {
  const suffix = stackType === 'admin' ? 'AdminStack' : 'Stack';
  return \`\${STACK_NAME_PREFIX}\${suffix}-\${env}\`;
}

export function getS3BucketName(type: string, region: string, env: string, accountId: string): string {
  return \`\${RESOURCE_PREFIX}-\${type}-\${region}-\${env}-\${accountId}\`;
}

export function getDynamoTableName(tableName: string, region: string, env: string): string {
  return \`\${RESOURCE_PREFIX}-\${tableName}-\${region}-\${env}\`;
}

export function getLambdaFunctionName(functionName: string, region: string, env: string): string {
  return \`\${RESOURCE_PREFIX}-\${functionName}-\${region}-\${env}\`;
}

export function getCognitoPoolName(poolType: string, env: string): string {
  return \`\${RESOURCE_PREFIX}-\${poolType}-\${env}\`;
}

export function getLayerName(layerName: string, env: string): string {
  return \`\${RESOURCE_PREFIX}-\${layerName}-\${env}\`;
}
`;

fs.writeFileSync(infraConfigPath, infraConfigContent);
console.log(`✅ Successfully generated ${infraConfigPath}`);

// Update Cargo.toml lib name
if (fs.existsSync(cargoTomlPath)) {
  let cargoContent = fs.readFileSync(cargoTomlPath, 'utf8');

  // Check if [lib] section exists and update name
  if (cargoContent.includes('[lib]')) {
    cargoContent = cargoContent.replace(
      /(\[lib\][^\[]*name = )"[^"]*"/,
      `$1"${derivedConfig.rustLibName}"`
    );

    fs.writeFileSync(cargoTomlPath, cargoContent);
    console.log(`✅ Updated Rust library name to: ${derivedConfig.rustLibName}`);
  }
}

// Generate Rust configuration
const rustConfigDir = path.join(projectRoot, 'app/src-tauri/src/generated');
const rustConfigPath = path.join(rustConfigDir, 'config.rs');

if (!fs.existsSync(rustConfigDir)) {
  fs.mkdirSync(rustConfigDir, { recursive: true });
}

const rustConfigContent = `//! Auto-generated configuration file
//! DO NOT EDIT MANUALLY - Generated by scripts/sync-product-config.js
//!
//! Source: product.config.json (technicalName: "${technicalName}")
//! Generated: ${new Date().toISOString()}
//! Environment: ${env}

/// Database configuration
pub const DB_PRODUCTION: &str = "${derivedConfig.databaseName}";
pub const DB_MOCK: &str = "${derivedConfig.databaseNameMock}";

/// Logging configuration
pub const LOG_DIRECTORY: &str = "${derivedConfig.logDirectory}";

/// Product information
pub const PRODUCT_NAME: &str = "${activeConfig.productName}";
pub const PRODUCT_VERSION: &str = "${activeConfig.version}";
pub const PRODUCT_IDENTIFIER: &str = "${activeConfig.identifier}";
`;

fs.writeFileSync(rustConfigPath, rustConfigContent);
console.log(`✅ Successfully generated ${rustConfigPath}`);

// Create Rust module file to export config
const rustModPath = path.join(rustConfigDir, 'mod.rs');
const rustModContent = `//! Auto-generated module
//! DO NOT EDIT MANUALLY

pub mod config;
`;
fs.writeFileSync(rustModPath, rustModContent);
console.log(`✅ Successfully generated ${rustModPath}`);

console.log('\n🎉 Product configuration sync completed!');
console.log('📝 Generated configuration files:');
console.log(`   - ${frontendConfigPath}`);
console.log(`   - ${infraConfigPath}`);
console.log(`   - ${rustConfigPath}`);
