import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: ['dist/**', 'src-tauri/**'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks,
    },
    rules: {
      // React Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Pillar A: Nominal Typing - discourage plain string/number for IDs
      '@typescript-eslint/no-inferrable-types': 'off',

      // Pillar D: FSM - discourage boolean state
      // (manual review needed, no direct rule)

      // Pillar I: Firewalls - no deep imports
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['../**/internal/*', '../**/adapters/*', '../**/headless/*'],
            message: 'Import from module index instead (Pillar I: Firewalls)',
          },
        ],
      }],

      // Pillar L: Headless - no JSX in headless hooks
      // (enforced by file location convention)

      // General TypeScript
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',

      // Code quality
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
];
