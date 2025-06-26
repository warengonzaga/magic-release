import security from 'eslint-plugin-security';
import securityNode from 'eslint-plugin-security-node';
import typescriptParser from '@typescript-eslint/parser';

const config = [
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json',
      },
    },
    plugins: {
      security,
      'security-node': securityNode,
    },
    rules: {
      // ESLint Security Plugin Rules
      'security/detect-unsafe-regex': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'error',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-non-literal-regexp': 'error',
      'security/detect-non-literal-require': 'warn',
      'security/detect-object-injection': 'warn',
      'security/detect-possible-timing-attacks': 'error',
      'security/detect-pseudoRandomBytes': 'error',
      'security/detect-bidi-characters': 'error',
      
      // Node.js Security Rules (using available rules from the plugin)
      'security-node/detect-crlf': 'error',
      'security-node/detect-unhandled-async-errors': 'error',
      'security-node/detect-unhandled-event-errors': 'error',
    },
  },
];

export default config;
