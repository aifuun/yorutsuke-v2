#!/usr/bin/env node

/**
 * 查询本地SQLite数据库 - Tauri SQL插件版本
 *
 * 这个脚本使用两种方法:
 * 1. 优先: Tauri SQL plugin直接访问 (需要在Tauri应用环境中运行)
 * 2. 备选: 直接访问文件系统 (当Tauri不可用时)
 *
 * 使用方法:
 *   npm run db:summary      # 显示数据库汇总
 *   npm run db:transactions # 显示transaction表
 *   npm run db:images      # 显示images表
 *   npm run db:query [table] [limit]  # 自定义查询
 */

import Database from 'better-sqlite3';
import path from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';

const args = process.argv.slice(2);
const table = args[0] || 'transactions';
const limit = parseInt(args[1]) || 10;
const json = args.includes('--json');

// Tauri SQL插件在不同平台的存储位置
const tauriDataDirs = {
  darwin: [
    path.join(homedir(), 'Library/Application Support/com.yorutsuke.app'),
  ],
  linux: [
    path.join(homedir(), '.local/share/com.yorutsuke.app'),
    path.join(process.env.XDG_DATA_HOME || '', 'com.yorutsuke.app'),
  ],
  win32: [
    path.join(process.env.APPDATA || '', 'com.yorutsuke.app'),
  ],
};

const platform = process.platform;
const possibleDirs = tauriDataDirs[platform] || [];

// 寻找数据库文件
function findDatabase() {
  for (const dir of possibleDirs) {
    const productionDb = path.join(dir, 'yorutsuke.db');
    if (existsSync(productionDb)) {
      return productionDb;
    }
  }
  return null;
}

// 执行数据库查询
function main() {
  const dbPath = findDatabase();

  if (!dbPath) {
    console.error('❌ 错误: 未找到本地SQLite数据库');
    console.error('\n📍 搜索位置:');
    possibleDirs.forEach((dir) => console.error(`   - ${dir}`));
    console.error('\n💡 提示: 需要运行过Yorutsuke应用至少一次才能创建数据库');
    console.error('\n📋 可能的原因:');
    console.error('   1. 应用还没有启动过');
    console.error('   2. 应用数据存储在其他位置');
    console.error('   3. 数据库文件被删除了');
    process.exit(1);
  }

  try {
    const db = new Database(dbPath, { readonly: true });

    // 显示数据库汇总
    if (table === '--summary') {
      console.log(`\n📊 数据库汇总: ${dbPath}\n`);

      const tableList = db
        .prepare(`
          SELECT name FROM sqlite_master
          WHERE type='table'
          ORDER BY name
        `)
        .all();

      console.log('📋 表列表:\n');
      for (const { name } of tableList) {
        const count = db
          .prepare(`SELECT COUNT(*) as count FROM ${name}`)
          .get();
        console.log(`   ${name.padEnd(25)} : ${count.count} 行`);
      }

      console.log('');
      db.close();
      return;
    }

    // 查询特定表
    console.log(`\n📊 查询表: ${table} (最多 ${limit} 行)\n`);

    const query = `SELECT * FROM ${table} LIMIT ${limit}`;
    const rows = db.prepare(query).all();

    if (rows.length === 0) {
      console.log(`✅ 表 "${table}" 存在但为空\n`);
      db.close();
      return;
    }

    // JSON输出
    if (json) {
      console.log(JSON.stringify(rows, null, 2));
      db.close();
      return;
    }

    // 格式化输出
    console.log(`✅ 找到 ${rows.length} 行:\n`);
    console.log('─'.repeat(120));

    rows.forEach((row, idx) => {
      console.log(`\n[${idx + 1}]`);
      Object.entries(row).forEach(([key, value]) => {
        let displayValue = value;
        if (typeof value === 'string' && value.length > 80) {
          displayValue = value.substring(0, 77) + '...';
        } else if (typeof value === 'object' && value !== null) {
          displayValue = JSON.stringify(value).substring(0, 77) + '...';
        }
        console.log(`   ${key.padEnd(20)}: ${displayValue}`);
      });
    });

    console.log('\n' + '─'.repeat(120));
    console.log(`\n✨ 成功获取 ${rows.length} 行\n`);
    db.close();
  } catch (error) {
    console.error('❌ 数据库查询错误:', error.message);
    console.error('\n🔧 故障排除:');
    console.error('   1. 确保已运行过Yorutsuke应用');
    console.error('   2. 查询时应用不要运行 (数据库文件被锁定)');
    console.error('   3. 使用 --summary 选项查看可用的表');
    process.exit(1);
  }
}

main();
