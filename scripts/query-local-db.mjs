#!/usr/bin/env node

import Database from 'better-sqlite3';
import path from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';

/**
 * Query local SQLite database
 * Usage: node scripts/query-local-db.mjs [table] [limit]
 * Example: node scripts/query-local-db.mjs transactions 10
 *          node scripts/query-local-db.mjs images
 *          node scripts/query-local-db.mjs --summary
 */

async function main() {
  const table = process.argv[2] || 'transactions';
  const limit = parseInt(process.argv[3]) || 10;
  const json = process.argv.includes('--json');

  // Possible database locations (Tauri app data directories)
  const possiblePaths = [
    path.join(homedir(), '.appdata', 'yorutsuke', 'yorutsuke.db'),
    path.join(homedir(), '.appdata', 'com.yorutsuke', 'yorutsuke.db'),
    path.join(homedir(), '.local', 'share', 'yorutsuke', 'yorutsuke.db'),
    path.join(homedir(), 'Library', 'Application Support', 'com.yorutsuke', 'yorutsuke.db'),
    path.join(homedir(), 'AppData', 'Local', 'yorutsuke', 'yorutsuke.db'),
  ];

  let dbPath = null;
  for (const p of possiblePaths) {
    if (existsSync(p)) {
      dbPath = p;
      break;
    }
  }

  if (!dbPath) {
    console.error('❌ Error: Local SQLite database not found');
    console.error('\nSearched locations:');
    possiblePaths.forEach((p) => console.error(`  - ${p}`));
    console.error('\n💡 Tip: Run the Yorutsuke app at least once to create the database');
    process.exit(1);
  }

  try {
    const db = new Database(dbPath, { readonly: true });

    // Summary of all tables
    if (table === '--summary') {
      console.log(`📊 Database Summary: ${dbPath}\n`);
      const tables = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table'
        ORDER BY name
      `).all();

      console.log('📋 Tables:\n');
      for (const { name } of tables) {
        const count = db.prepare(`SELECT COUNT(*) as count FROM ${name}`).get();
        console.log(`  ${name.padEnd(25)} : ${count.count} rows`);
      }
      console.log('');
      db.close();
      return;
    }

    // Query specific table
    console.log(`📊 Querying: ${table} (limit ${limit})\n`);

    const query = `SELECT * FROM ${table} LIMIT ${limit}`;
    const rows = db.prepare(query).all();

    if (rows.length === 0) {
      console.log(`✅ Table "${table}" exists but is empty\n`);
      db.close();
      return;
    }

    // JSON output
    if (json) {
      console.log(JSON.stringify(rows, null, 2));
      db.close();
      return;
    }

    // Formatted output
    console.log(`✅ Found ${rows.length} rows:\n`);
    console.log('─'.repeat(120));

    rows.forEach((row, idx) => {
      console.log(`\n[${idx + 1}]`);
      Object.entries(row).forEach(([key, value]) => {
        let displayValue = value;
        if (typeof value === 'string' && value.length > 80) {
          displayValue = value.substring(0, 77) + '...';
        }
        console.log(`  ${key.padEnd(20)}: ${displayValue}`);
      });
    });

    console.log('\n' + '─'.repeat(120));
    console.log(`\n✨ Retrieved ${rows.length} rows from "${table}"\n`);
    db.close();
  } catch (error) {
    console.error('❌ Error querying database:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Ensure the Yorutsuke app has been run at least once');
    console.error('2. Database file may be locked if the app is running');
    console.error('3. Use --summary flag to see available tables');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
