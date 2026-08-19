import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * A durable, repo-level regression test for the rule stated repeatedly across the Phase 1/2.1/2.2
 * briefs: this library must remain completely business-agnostic — no import of, or dependency on,
 * a Product/Restaurant/Menu/Cart/Order/Payment/Delivery/User/Merchant/Store concept. Checks only
 * `import` statements (actual dependencies), not comments or string literals — this file's own
 * doc comments (and several others in this library) legitimately *discuss* these forbidden terms
 * while explaining the rule, which a raw substring scan across full file content would misreport
 * as violations. Nx's own `@nx/enforce-module-boundaries` (verified via `nx lint`) already makes
 * most of this structurally impossible; this is a second, source-level check scoped specifically
 * to what actually matters — real imports — kept independent of that tool.
 */

const FORBIDDEN_TERMS = ['Product', 'Restaurant', 'Menu', 'Cart', 'Order', 'Payment', 'Delivery', 'User', 'Merchant', 'Store'];
const IMPORT_LINE = /^\s*import\s+(?:type\s+)?.+from\s+['"]([^'"]+)['"];?\s*$/;

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }
    if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts') && entry !== 'business-agnostic.spec.ts') {
      files.push(fullPath);
    }
  }
  return files;
}

describe('playcanvas-runtime — business-agnostic dependency check', () => {
  const sourceFiles = collectSourceFiles(join(__dirname, 'lib'));

  it('found source files to check (sanity check on the scan itself)', () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
  });

  it.each(sourceFiles.map((file) => [file.replace(join(__dirname, 'lib') + '\\', '').replace(join(__dirname, 'lib') + '/', ''), file]))(
    'imports in %s reference no business-domain module',
    (_label, file) => {
      const importSources = readFileSync(file, 'utf-8')
        .split('\n')
        .map((line) => IMPORT_LINE.exec(line)?.[1])
        .filter((source): source is string => Boolean(source));

      for (const source of importSources) {
        for (const term of FORBIDDEN_TERMS) {
          expect(source.toLowerCase()).not.toContain(term.toLowerCase());
        }
      }
    },
  );

  it('never statically value-imports "playcanvas" — only type-only imports and the dynamic import() inside PlaycanvasRuntime.create() are allowed', () => {
    for (const file of sourceFiles) {
      const content = readFileSync(file, 'utf-8');
      const hasValueImport = /^\s*import\s+(?!type\s)[^;]*from\s+['"]playcanvas['"];?/m.test(content);
      expect(hasValueImport).toBe(false);
    }
  });
});
