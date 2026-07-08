const js = require('@eslint/js');

module.exports = [
  { ignores: ['node_modules/**', 'client/vendor/**', 'data/**', 'test-results/**', 'playwright-report/**', 'pebble/**'] },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    rules: {
      ...js.configs.recommended.rules,
      // Legacy browser modules intentionally expose compatibility globals while
      // they are split into ESM domains. Keep structural/runtime checks active.
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-redeclare': 'off',
      'no-empty': 'off',
      'no-prototype-builtins': 'off',
      'no-useless-escape': 'off',
      'no-control-regex': 'off',
      'no-constant-condition': 'off',
      'no-fallthrough': 'off',
      'no-unreachable': 'error',
      'no-unsafe-finally': 'error',
      'valid-typeof': 'error',
      'no-debugger': 'error',
    },
  },
  {
    files: ['client/js/**/*.mjs'],
    rules: {
      // The compatibility layer still contains deliberate post-return fallback
      // implementations and duplicate bridge keys. New server/tooling code does not.
      'no-unreachable': 'off',
      'no-dupe-keys': 'off',
    },
  },
];
