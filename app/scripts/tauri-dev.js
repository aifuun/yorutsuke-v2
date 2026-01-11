#!/usr/bin/env node

/**
 * Tauri dev wrapper with dynamic port support
 * Usage: node scripts/tauri-dev.js [port]
 */

import { spawn } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const port = process.env.VITE_PORT || process.argv[2] || '1420';
const configPath = join(__dirname, '../src-tauri/tauri.conf.json');

// Read config
const config = JSON.parse(readFileSync(configPath, 'utf-8'));
const originalDevUrl = config.build.devUrl;

// Update devUrl
config.build.devUrl = `http://localhost:${port}`;
writeFileSync(configPath, JSON.stringify(config, null, 2));

console.log(`\x1b[36m[Tauri Dev]\x1b[0m Starting on port \x1b[33m${port}\x1b[0m`);

// Run tauri dev
const tauriProcess = spawn('tauri', ['dev'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, VITE_PORT: port }
});

// Restore config on exit
const restore = () => {
  config.build.devUrl = originalDevUrl;
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log('\n\x1b[36m[Tauri Dev]\x1b[0m Config restored');
  process.exit();
};

process.on('SIGINT', restore);
process.on('SIGTERM', restore);
tauriProcess.on('exit', restore);
