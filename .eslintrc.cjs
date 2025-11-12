module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2022,
    ecmaFeatures: {
      jsx: true
    }
  },
  plugins: ['@typescript-eslint', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended'
  ],
  rules: {
    // Disallow calling navigationStack.push(...) by AST selector.
    // File-level exceptions provided in overrides below.
    'no-restricted-syntax': [
      'error',
      {
        selector: "CallExpression[callee.object.name='navigationStack'][callee.property.name='push']",
        message:
          'Do not call navigationStack.push outside approved files. Use ContextLink or useStackedNavigate instead.'
      }
    ]
  },
  overrides: [
    {
      // Allowlist - these files intentionally call navigationStack.push
      files: [
        'src/hooks/useStackedNavigate.ts',
        'src/components/ContextLink.tsx',
        'src/contexts/NavigationStackContext.tsx',
        '**/__tests__/**',
        '**/*.test.*',
        '**/*.spec.*'
      ],
      rules: {
        'no-restricted-syntax': 'off'
      }
    }
  ],
  settings: {
    react: { version: 'detect' }
  }
}


