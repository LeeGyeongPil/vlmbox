import { useCallback, useEffect, useState } from 'react';
import { en, type MessageKey } from './messages/en.js';
import { ko } from './messages/ko.js';

export type Lang = 'en' | 'ko';

/** localStorage key that remembers the language choice. */
export const LANG_KEY = 'vlmbox.demo.lang';

export const MESSAGES: Record<Lang, Record<MessageKey, string>> = { en, ko };

const isLang = (v: unknown): v is Lang => v === 'en' || v === 'ko';

/** First-visit rule: the browser's first language decides (ko* -> Korean, anything else -> English). */
export function detectLang(languages: readonly string[] | undefined): Lang {
  const first = languages?.[0] ?? '';
  return first.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

type Env = {
  search?: string;
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  languages?: readonly string[];
};

/** Order: ?lang= in the address (handy for screenshots) > saved choice > browser language. */
export function initialLang(env: Env): Lang {
  const fromQuery = new URLSearchParams(env.search ?? '').get('lang');
  if (isLang(fromQuery)) return fromQuery;
  let saved: string | null = null;
  try {
    saved = env.storage?.getItem(LANG_KEY) ?? null;
  } catch {
    saved = null; // storage can be blocked; fall back to detection
  }
  if (isLang(saved)) return saved;
  return detectLang(env.languages);
}

/** Fill {name} placeholders. */
export function format(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}

function browserEnv(): Env {
  let storage: Storage | null = null;
  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }
  return { search: window.location.search, storage, languages: navigator.languages ?? [navigator.language] };
}

export type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

/** React hook: current language, a setter that saves the choice, and the translate function. */
export function useLang(): { lang: Lang; setLang: (lang: Lang) => void; t: Translate } {
  const [lang, setLangState] = useState<Lang>(() => initialLang(browserEnv()));

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = MESSAGES[lang]['page.title'];
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(LANG_KEY, next);
    } catch {
      // blocked storage: the choice still applies for this visit
    }
  }, []);

  const t = useCallback<Translate>((key, params) => format(MESSAGES[lang][key], params), [lang]);
  return { lang, setLang, t };
}
