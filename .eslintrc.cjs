module.exports = {
  root: true,
  env: { browser: true, node: true, es2022: true },
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  // Legacy Vercel APIs and TypeScript design prototypes are not production entry points.
  ignorePatterns: ['**/node_modules/**', '**/dist/**', 'test-results/**', 'playwright-report/**', 'api/**', '**/*.ts', '**/*.tsx'],
  rules: {
    'no-debugger': 'error',
    'no-dupe-args': 'error',
    'no-dupe-keys': 'error',
    'no-duplicate-case': 'error',
    'no-unreachable': 'error',
    'no-invalid-regexp': 'error',
    'no-unsafe-finally': 'error',
    'no-unsafe-negation': 'error',
    'no-unexpected-multiline': 'error',
    'no-loss-of-precision': 'error',
    'no-sparse-arrays': 'error',
  },
};
