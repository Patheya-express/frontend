import type { Config } from 'jest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Workspace path aliases (@patheya-express-frontend/*) are resolved here directly from
// tsconfig.base.json rather than hardcoded, so this config stays correct if paths change.
const { compilerOptions } = JSON.parse(
  readFileSync(join(__dirname, '../../../tsconfig.base.json'), 'utf-8'),
) as { compilerOptions: { paths: Record<string, string[]> } };

const moduleNameMapper: Record<string, string> = {};
for (const [alias, [target]] of Object.entries(compilerOptions.paths)) {
  const pattern = `^${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;
  moduleNameMapper[pattern] = join(__dirname, '../../../', target.replace(/\.ts$/, ''));
}

const config: Config = {
  displayName: 'cart',
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.(ts|mjs|js|html)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$',
      },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  moduleFileExtensions: ['ts', 'html', 'js', 'json'],
  moduleNameMapper,
  coverageDirectory: '../../../coverage/libs/features/cart',
};

export default config;
