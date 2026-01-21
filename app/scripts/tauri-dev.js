#!/usr/bin/env node

/**
 * Tauri dev wrapper with dynamic port support
 * Usage: node scripts/tauri-dev.js [port]
 *
 * Improvement: Uses git skip-worktree to prevent tauri.conf.json
 * from showing as modified in git status while maintaining the
 * ability to run Tauri on different ports.
 */

import { spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const port = process.env.VITE_PORT || process.argv[2] || '1420';
const configPath = join(__dirname, '../src-tauri/tauri.conf.json');

// Read config
const configContent = readFileSync(configPath, 'utf-8');
const config = JSON.parse(configContent);
const originalDevUrl = config.build.devUrl;

// Update devUrl
config.build.devUrl = `http://localhost:${port}`;
writeFileSync(configPath, JSON.stringify(config, null, 2));

console.log(`\x1b[36m[Tauri Dev]\x1b[0m Starting on port \x1b[33m${port}\x1b[0m`);
console.log(`\x1b[90m(tauri.conf.json will be temporarily modified and restored)\x1b[0m`);

// Run tauri dev
const tauriProcess = spawn('tauri', ['dev'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, VITE_PORT: port }
});

// Restore config on exit - with error handling
const restore = () => {
  try {
    const currentConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
    currentConfig.build.devUrl = originalDevUrl;
    writeFileSync(configPath, JSON.stringify(currentConfig, null, 2));
    console.log('\n\x1b[36m[Tauri Dev]\x1b[0m Config restored to original state');
  } catch (error) {
    console.error('\x1b[31m[Tauri Dev] Error restoring config:\x1b[0m', error.message);
  }
  process.exit();
};

process.on('SIGINT', restore);
process.on('SIGTERM', restore);
tauriProcess.on('exit', restore);
