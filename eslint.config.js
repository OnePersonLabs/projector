import tseslint from 'typescript-eslint';
const boundaries = (files, forbidden) => ({
  files,
  rules: { 'no-restricted-imports': ['error', { patterns: [
    ...forbidden.map(name => ({ group: [`**/${name}/**`], message: `Preserve module dependency direction (${name}).` })),
    ...['documents', 'index', 'kernel', 'change', 'host'].filter(name => !forbidden.includes(name)).map(name => ({
      group: [`../${name}/**`, `!../${name}/index.ts`], message: `Use the ${name} public module entry point.`
    }))
  ] }] }
});
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  ...tseslint.configs.recommended,
  { rules: { '@typescript-eslint/no-explicit-any': 'error', '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }] } },
  boundaries(['src/documents/**/*.ts'], ['index', 'kernel', 'change', 'host', 'testkit']),
  boundaries(['src/index/**/*.ts'], ['kernel', 'change', 'host', 'testkit']),
  boundaries(['src/kernel/**/*.ts'], ['change', 'host', 'testkit']),
  boundaries(['src/change/**/*.ts'], ['host', 'testkit']),
  boundaries(['src/host/**/*.ts'], ['testkit'])
);
