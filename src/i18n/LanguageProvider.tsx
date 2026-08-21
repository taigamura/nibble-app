import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { LanguageState } from '../settings/languageState';
import type { Language } from './language';
import { en, format, ja, type StringKey } from './strings';

export type { Language };

export interface LanguageValue {
  /** The user's stored preference ('system' | 'ja' | 'en'). */
  language: Language;
  /** The resolved language actually in effect ('ja' | 'en'). */
  resolved: 'ja' | 'en';
  /** Looks up `key` in the resolved table (falling back to `en`, then the raw key), applying `params` if given. */
  t: (key: StringKey, params?: Record<string, string | number>) => string;
  /** Persists and applies a new language preference. */
  setLanguage: (next: Language) => void;
}

const LanguageContext = createContext<LanguageValue | null>(null);

const TABLES: Record<'ja' | 'en', Record<string, string>> = { ja, en };

/** Resolves the OS locale to 'ja' or 'en'; any failure (or non-Japanese locale) falls back to 'en'. */
function resolveSystemLanguage(): 'ja' | 'en' {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    return locale.toLowerCase().startsWith('ja') ? 'ja' : 'en';
  } catch {
    return 'en';
  }
}

/**
 * Provides the active language (and its `t()` lookup) to the tree and owns
 * the language preference.
 *
 * Resolution: an explicit 'ja'/'en' preference wins; 'system' follows the
 * device locale via `Intl.DateTimeFormat().resolvedOptions().locale`. The
 * stored preference is restored on mount from `LanguageState` -- it defaults
 * to 'ja' (see `LanguageState.get()`) so the app paints in Japanese before
 * the async restore resolves, matching the app's Japanese-first default.
 *
 * `languageState` is injectable for tests; it defaults to the AsyncStorage
 * -backed implementation.
 */
export function LanguageProvider({
  children,
  languageState = new LanguageState(),
}: {
  children: React.ReactNode;
  languageState?: LanguageState;
}) {
  const [language, setLanguageState] = useState<Language>('ja');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await languageState.get();
      if (!cancelled) setLanguageState(stored);
    })();
    return () => {
      cancelled = true;
    };
  }, [languageState]);

  const setLanguage = useMemo(
    () => (next: Language) => {
      setLanguageState(next);
      // Fire-and-forget: the in-memory state already repaints the UI;
      // persisting is what makes the next cold start honor the choice.
      void languageState.set(next);
    },
    [languageState]
  );

  const resolved: 'ja' | 'en' = language === 'system' ? resolveSystemLanguage() : language;

  const t = useMemo<LanguageValue['t']>(() => {
    const table = TABLES[resolved];
    return (key, params) => {
      const template = table[key] ?? en[key] ?? key;
      return params ? format(template, params) : template;
    };
  }, [resolved]);

  const value = useMemo<LanguageValue>(
    () => ({ language, resolved, t, setLanguage }),
    [language, resolved, t, setLanguage]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** Reads the active language + `t()`. Throws if used outside a `LanguageProvider`. */
export function useLanguage(): LanguageValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}

/** Convenience hook for callers that only need the translation function. */
export function useT(): LanguageValue['t'] {
  return useLanguage().t;
}
