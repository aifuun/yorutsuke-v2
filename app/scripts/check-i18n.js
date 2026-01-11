#!/usr/bin/env node

/**
 * i18n Translation Coverage Checker
 *
 * Verifies that all translation keys exist in all locale files (en, ja, zh).
 *
 * Usage:
 *   node scripts/check-i18n.js
 *   npm run check:i18n
 *
 * Exit codes:
 *   0 - All keys present in all languages
 *   1 - Missing translations found
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Flatten nested object to dot notation
function flattenObject(obj, prefix = '') {
  const result = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey));
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

// Load and flatten locale files
const localesDir = path.join(__dirname, '../src/i18n/locales');
const locales = ['en', 'ja', 'zh'];
const data = {};

console.log('=== i18n Translation Coverage Check ===\n');

// Load all locale files
locales.forEach(locale => {
  const filePath = path.join(localesDir, `${locale}.json`);
  try {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    data[locale] = flattenObject(content);
    console.log(`✅ Loaded ${locale}.json - ${Object.keys(data[locale]).length} keys`);
  } catch (error) {
    console.error(`❌ Failed to load ${locale}.json:`, error.message);
    process.exit(1);
  }
});

// Collect all unique keys
const allKeys = new Set();
locales.forEach(locale => {
  Object.keys(data[locale]).forEach(key => allKeys.add(key));
});

console.log(`\n📊 Total unique keys: ${allKeys.size}\n`);

// Check for missing translations
const missing = {
  en: [],
  ja: [],
  zh: []
};

let hasMissing = false;

allKeys.forEach(key => {
  const presentIn = locales.filter(locale => key in data[locale]);

  if (presentIn.length < 3) {
    hasMissing = true;
    const missingIn = locales.filter(locale => !(key in data[locale]));

    console.log(`❌ Key: ${key}`);
    console.log(`   Present in: ${presentIn.join(', ')}`);
    console.log(`   Missing in: ${missingIn.join(', ')}`);
    console.log('');

    missingIn.forEach(locale => missing[locale].push(key));
  }
});

if (hasMissing) {
  console.log('=== Summary ===\n');
  locales.forEach(locale => {
    if (missing[locale].length > 0) {
      console.log(`❌ ${locale}.json is missing ${missing[locale].length} keys:`);
      missing[locale].forEach(key => console.log(`   - ${key}`));
      console.log('');
    } else {
      console.log(`✅ ${locale}.json has all keys`);
    }
  });

  process.exit(1);
} else {
  console.log('✅ All keys are present in all three languages!\n');
  console.log('=== Coverage Summary ===');
  locales.forEach(locale => {
    console.log(`✅ ${locale}.json: ${Object.keys(data[locale]).length} keys`);
  });

  process.exit(0);
}
