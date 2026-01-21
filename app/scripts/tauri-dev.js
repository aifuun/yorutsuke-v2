#!/usr/bin/env node

/**
 * Tauri dev wrapper with dynamic port support
 * Usage: node scripts/tauri-dev.js [port]
 *
 * Design (Temporary Config File Pattern):
 * - Creates tauri.conf.temp.json with desired port
 * - Tauri dev uses temp config, never modifies committed tauri.conf.json
 * - Temp file is git-ignored (added to .gitignore)
 * - On exit, cleans up temp file and all child processes
 * - All other config changes are visible to git (not hidden)
 */

import { spawn } from 'child_process';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { kill } from 'process';

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

// Clean up temp config and kill process tree on exit
const cleanup = () => {
  try {
    // Kill the entire process group (tauri + vite + all children)
    if (tauriProcess && tauriProcess.pid) {
      kill(-tauriProcess.pid, 'SIGTERM');
    }

    // Clean up temp config file
    if (existsSync(tempConfigPath)) {
      unlinkSync(tempConfigPath);
      console.log('\x1b[36m[Tauri Dev]\x1b[0m Cleaned up temporary config');
    }
  } catch (error) {
    // Silently ignore errors
  }

  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
tauriProcess.on('exit', cleanup);
