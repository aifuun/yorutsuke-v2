#!/usr/bin/env node

/**
 * Tauri dev wrapper with dynamic port support
 * Usage: node scripts/tauri-dev.js [port]
 *
 * Design (Temporary Config File Pattern):
 * - Creates tauri.conf.temp.json with desired port
 * - Tauri dev uses temp config, never modifies committed tauri.conf.json
 * - Temp file is git-ignored (added to .gitignore)
 * - On exit, cleans up temp file
 * - All other config changes are visible to git (not hidden)
 */

import { spawn } from 'child_process';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const port = process.env.VITE_PORT || process.argv[2] || '1420';
const configPath = join(__dirname, '../src-tauri/tauri.conf.json');
const tempConfigPath = join(__dirname, '../src-tauri/tauri.conf.temp.json');

// Read original config
const configContent = readFileSync(configPath, 'utf-8');
const config = JSON.parse(configContent);

// Create temp config with updated port
config.build.devUrl = `http://localhost:${port}`;
writeFileSync(tempConfigPath, JSON.stringify(config, null, 2));

console.log(`\x1b[36m[Tauri Dev]\x1b[0m Starting on port \x1b[33m${port}\x1b[0m`);
console.log(`\x1b[90m(using temporary config: tauri.conf.temp.json)\x1b[0m`);

// Run tauri dev with temp config
const tauriProcess = spawn('tauri', ['dev', '--config', 'src-tauri/tauri.conf.temp.json'], {
  stdio: 'inherit',
  shell: true,
  cwd: join(__dirname, '..'),
  env: { ...process.env, VITE_PORT: port }
});

// Clean up temp config on exit
const cleanup = () => {
  try {
    if (existsSync(tempConfigPath)) {
      unlinkSync(tempConfigPath);
      console.log('\n\x1b[36m[Tauri Dev]\x1b[0m Cleaned up temporary config');
    }
  } catch (error) {
    console.error('\x1b[31m[Tauri Dev] Error cleaning up:\x1b[0m', error.message);
  }
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
tauriProcess.on('exit', cleanup);
