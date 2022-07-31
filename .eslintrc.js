module.exports = {
  'env': {
    'browser': true,
    'es2021': true,
  },
  'extends': [
    'plugin:@typescript-eslint/recommended',
  ],
  'parser': '@typescript-eslint/parser',
  'parserOptions': {
    'ecmaVersion': 'latest',
    'sourceType': 'module',
  },
  'plugins': [
    '@typescript-eslint/eslint-plugin',
    'eslint-plugin-tsdoc',
  ],
  'rules': {
    'max-len': 'off',
    'tsdoc/syntax': 'warn',
    '@typescript-eslint/no-var-requires': 0,
  },
};
