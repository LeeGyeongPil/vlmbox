// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../demo/src/App.js';
import { detectLang, format, initialLang, LANG_KEY, MESSAGES } from '../demo/src/i18n.js';

function setBrowserLanguages(languages: string[]) {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(languages);
}

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
  setBrowserLanguages(['en-US']);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const heading = () => screen.getByRole('heading', { level: 1 }).textContent;

describe('demo language menu (AC-7)', () => {
  it('uses the exact storage key from the docs', () => {
    expect(LANG_KEY).toBe('vlmbox.demo.lang');
  });

  it('switches the whole page and remembers the choice', () => {
    const view = render(<App />);
    expect(heading()).toBe('vlmbox demo');

    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'ko' } });
    expect(heading()).toBe('vlmbox 데모');
    expect(window.localStorage.getItem('vlmbox.demo.lang')).toBe('ko');
    expect(document.documentElement.lang).toBe('ko');
    // labels, buttons-in-menus, placeholder and notice follow too
    expect(screen.getByLabelText('다음 규약으로 읽기')).toBeTruthy();
    expect((screen.getByLabelText('모델 응답 (수정 가능)') as HTMLTextAreaElement).placeholder).toContain('붙여 넣으세요');
    expect(screen.getByRole('note').textContent).toContain('연습용 예시');
    expect(screen.queryByText('Example response')).toBeNull();

    // reopening keeps Korean (saved value), even though the browser says English
    view.unmount();
    render(<App />);
    expect(heading()).toBe('vlmbox 데모');

    fireEvent.change(screen.getByLabelText('언어'), { target: { value: 'en' } });
    expect(heading()).toBe('vlmbox demo');
    expect(window.localStorage.getItem('vlmbox.demo.lang')).toBe('en');
  });

  it('a saved value wins over the browser language', () => {
    window.localStorage.setItem(LANG_KEY, 'en');
    setBrowserLanguages(['ko-KR']);
    render(<App />);
    expect(heading()).toBe('vlmbox demo');
  });

  it('without a saved value the browser language decides on first visit', () => {
    setBrowserLanguages(['ko-KR', 'en-US']);
    render(<App />);
    expect(heading()).toBe('vlmbox 데모');
    // detecting does not save anything: only an explicit choice is stored
    expect(window.localStorage.getItem(LANG_KEY)).toBeNull();
  });

  it('?lang= in the address overrides for screenshots', () => {
    window.history.replaceState(null, '', '/?lang=ko');
    render(<App />);
    expect(heading()).toBe('vlmbox 데모');
  });
});

describe('language rules', () => {
  it('detectLang: ko* is Korean, everything else English', () => {
    expect(detectLang(['ko'])).toBe('ko');
    expect(detectLang(['ko-KR'])).toBe('ko');
    expect(detectLang(['KO-kr'])).toBe('ko');
    expect(detectLang(['en-US', 'ko'])).toBe('en');
    expect(detectLang(['ja'])).toBe('en');
    expect(detectLang([])).toBe('en');
    expect(detectLang(undefined)).toBe('en');
  });

  it('initialLang order: query > saved > browser', () => {
    const storage = { getItem: () => 'ko', setItem: () => {} };
    expect(initialLang({ search: '?lang=en', storage, languages: ['ko'] })).toBe('en');
    expect(initialLang({ search: '', storage, languages: ['en'] })).toBe('ko');
    expect(initialLang({ search: '?lang=xx', storage: null, languages: ['ko'] })).toBe('ko');
  });

  it('a blocked storage does not break detection', () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {},
    };
    expect(initialLang({ storage, languages: ['en'] })).toBe('en');
  });

  it('en and ko have exactly the same keys and placeholders', () => {
    const enKeys = Object.keys(MESSAGES.en).sort();
    const koKeys = Object.keys(MESSAGES.ko).sort();
    expect(enKeys.filter((k) => !koKeys.includes(k))).toEqual([]);
    expect(koKeys.filter((k) => !enKeys.includes(k))).toEqual([]);
    const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const key of enKeys) {
      const k = key as keyof typeof MESSAGES.en;
      expect(MESSAGES.en[k].length, key).toBeGreaterThan(0);
      expect(MESSAGES.ko[k].length, key).toBeGreaterThan(0);
      expect(placeholders(MESSAGES.ko[k]), key).toEqual(placeholders(MESSAGES.en[k]));
    }
  });

  it('format fills placeholders and leaves unknown ones', () => {
    expect(format('{w}×{h} {x}', { w: 1, h: 2 })).toBe('1×2 {x}');
  });
});
