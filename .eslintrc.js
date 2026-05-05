// https://docs.expo.dev/guides/using-eslint/
module.exports = {
  extends: 'expo',
  ignorePatterns: ['/dist/*', 'supabase/functions/**/*'],
  overrides: [
    {
      files: ['__tests__/**/*.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}'],
      rules: {
        'import/first': 'off',
      },
    },
  ],
};
