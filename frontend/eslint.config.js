const browserGlobals = [
  'Blob',
  'DOMException',
  'Event',
  'File',
  'FormData',
  'Headers',
  'IntersectionObserver',
  'URL',
  'URLSearchParams',
  'clearInterval',
  'clearTimeout',
  'console',
  'document',
  'fetch',
  'localStorage',
  'navigator',
  'setInterval',
  'setTimeout',
  'window',
]

export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: Object.fromEntries(browserGlobals.map((globalName) => [globalName, 'readonly'])),
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^[A-Z]' }],
    },
  },
]
