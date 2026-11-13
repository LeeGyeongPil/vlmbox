import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import pkg from '../package.json';

const root = new URL('..', import.meta.url).pathname;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? sourceFiles(p) : [p];
  });
}

describe('package shape (AC-5)', () => {
  it('has no runtime dependencies and react is an optional peer', () => {
    expect((pkg as Record<string, unknown>).dependencies ?? {}).toEqual({});
    expect(pkg.peerDependencies).toEqual({ react: '>=18' });
    expect(pkg.peerDependenciesMeta.react.optional).toBe(true);
  });

  it('the core entry and its modules never import react', () => {
    const core = sourceFiles(join(root, 'src')).filter((f) => !f.includes('/react/'));
    expect(core.length).toBeGreaterThan(10);
    for (const file of core) {
      const text = readFileSync(file, 'utf8');
      expect(text, file).not.toMatch(/from ['"]react/);
      expect(text, file).not.toMatch(/require\(['"]react/);
    }
  });

  it('exports map points at dist for the core and the react subpath', () => {
    expect(pkg.exports['.'].import).toBe('./dist/index.js');
    expect(pkg.exports['./react'].import).toBe('./dist/react/index.js');
    expect(pkg.engines.node).toBe('>=20');
    expect(pkg.license).toBe('MIT');
  });

  it('the version in package.json is the one documented in the changelog', () => {
    const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
    expect(changelog).toContain(`## [${pkg.version}]`);
  });
});
