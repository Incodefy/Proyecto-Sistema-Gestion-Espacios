module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  extends: 'eslint:recommended',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'commonjs',
  },
  rules: {
    'no-console': 'off', // Permitir console.log en Node.js
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-undef': 'error',
    'semi': ['error', 'always'],
    'quotes': ['error', 'single', { avoidEscape: true }],
  },
};
