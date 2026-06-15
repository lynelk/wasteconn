import globals from 'globals';
import pluginJs from '@eslint/js';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import pluginUnusedImports from 'eslint-plugin-unused-imports';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

const baseLanguageOptions = {
  globals: {
    ...globals.browser,
    ...globals.node
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  }
};

const sharedRules = {
  'no-unused-vars': 'off',
  'no-console': ['warn', { allow: ['warn', 'error'] }],
  'react/jsx-uses-vars': 'error',
  'react/jsx-uses-react': 'error',
  'unused-imports/no-unused-imports': 'error',
  'unused-imports/no-unused-vars': [
    'warn',
    {
      vars: 'all',
      varsIgnorePattern: '^_',
      args: 'after-used',
      argsIgnorePattern: '^_'
    }
  ],
  'react/prop-types': 'off',
  'react/react-in-jsx-scope': 'off',
  'react/no-unknown-property': ['error', { ignore: ['cmdk-input-wrapper', 'toast-close'] }],
  'react-hooks/rules-of-hooks': 'error',
  // Scale guard: never fetch high-cardinality entities unbounded on the client.
  // Use entity.list(sort, limit) / entity.filter(query, sort, limit), or the
  // EntitySelect / useEntitySearch helpers for pickers.
  'no-restricted-syntax': [
    'warn',
    {
      selector:
        "CallExpression[arguments.length=0][callee.property.name='list'][callee.object.property.name=/^(Customer|PickupRequest|Payment|Invoice|ServicePoint|SensorReading|VehicleTelematics|AuditLog)$/]",
      message:
        'Unbounded .list() on a high-cardinality entity. Pass a limit (list(sort, limit)) or use EntitySelect/useEntitySearch.',
    },
  ]
};

export default [
  {
    files: ['src/**/*.{js,mjs,cjs,jsx}'],
    ignores: ['src/components/ui/**/*'],
    ...pluginJs.configs.recommended,
    ...pluginReact.configs.flat.recommended,
    languageOptions: baseLanguageOptions,
    settings: {
      react: {
        version: 'detect'
      }
    },
    plugins: {
      react: pluginReact,
      'react-hooks': pluginReactHooks,
      'unused-imports': pluginUnusedImports
    },
    rules: sharedRules
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ...baseLanguageOptions,
      parser: tsParser
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'unused-imports': pluginUnusedImports
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/consistent-type-imports': 'warn',
      'unused-imports/no-unused-imports': 'error',
      'no-restricted-syntax': [
        'warn',
        {
          selector:
            "CallExpression[arguments.length=0][callee.property.name='list'][callee.object.property.name=/^(Customer|PickupRequest|Payment|Invoice|ServicePoint|SensorReading|VehicleTelematics|AuditLog)$/]",
          message:
            'Unbounded .list() on a high-cardinality entity. Pass a limit (list(sort, limit)) or use EntitySelect/useEntitySearch.',
        },
      ]
    }
  }
];
