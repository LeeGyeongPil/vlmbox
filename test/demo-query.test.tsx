// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../demo/src/App.js';
import { initialFromSearch } from '../demo/src/query.js';

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US']);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const at = (search: string) => {
  window.history.replaceState(null, '', '/' + search);
  render(<App />);
};
const maxError = () => screen.getByTestId('max-error').textContent;

describe('demo address parameters (?example=&readAs=&fit=)', () => {
  it('wrong-convention scene: qwen2.5-vl example read as qwen3-vl -> 894.7 px', () => {
    at('?example=qwen2.5-vl&readAs=qwen3-vl');
    expect(maxError()).toBe('894.7 px');
  });

  it('axis-swap scene: gemini example read as x-first-1000 -> 480.0 px', () => {
    at('?example=gemini&readAs=x-first-1000');
    expect(maxError()).toBe('480.0 px');
  });

  it('truncated scene: warning shown and exactly one box kept', () => {
    at('?example=qwen3-vl-truncated');
    expect(screen.getByTestId('warnings').textContent).toContain('cut off');
    expect(document.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('works together with ?lang=ko', () => {
    at('?lang=ko&example=qwen2.5-vl&readAs=qwen3-vl');
    expect(maxError()).toBe('894.7 px');
    expect(screen.getByTestId('warnings').textContent).toContain('이미지 안으로 잘랐습니다');
  });

  it('example alone uses its own model; unknown values are ignored', () => {
    at('?example=gemini&readAs=bogus&fit=nope');
    expect(maxError()).toBe('0.0 px');
    expect((screen.getByLabelText('Read as') as HTMLSelectElement).value).toBe('gemini');
    expect((screen.getByLabelText('Image fit') as HTMLSelectElement).value).toBe('contain');
  });

  it('unknown example falls back to the default; ?fit=cover is applied', () => {
    at('?example=nope&fit=cover');
    expect(maxError()).toBe('0.0 px');
    expect((screen.getByLabelText('Image fit') as HTMLSelectElement).value).toBe('cover');
  });

  it('initialFromSearch validates against the allowed lists', () => {
    const allowed = { examples: ['a', 'b'], readAs: ['x'], fits: ['contain'] };
    expect(initialFromSearch('?example=b&readAs=x&fit=contain', allowed, 'a')).toEqual({ exampleId: 'b', readAs: 'x', fit: 'contain' });
    expect(initialFromSearch('?example=z&readAs=y', allowed, 'a')).toEqual({ exampleId: 'a', readAs: undefined, fit: undefined });
  });
});
