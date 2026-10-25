'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { dict, type Dict, type Lang } from './dict';

type Ctx = { lang: Lang; t: Dict; rtl: boolean; setLang: (l: Lang) => void };

const LangContext = createContext<Ctx>({ lang: 'en', t: dict.en, rtl: false, setLang: () => {} });

const KEY = 'yd-lang';

/**
 * Site language. English by default; Hebrew via the EN | עב toggle, a ?lang=he link,
 * or the visitor's last choice (localStorage). Switching keeps you on the same page.
 */
export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('lang');
    const saved = window.localStorage.getItem(KEY);
    const initial: Lang = q === 'he' || q === 'en' ? q : saved === 'he' ? 'he' : 'en';
    setLangState(initial);
  }, []);

  useEffect(() => {
    const el = document.documentElement;
    el.lang = lang;
    el.dir = lang === 'he' ? 'rtl' : 'ltr';
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(KEY, l);
      const url = new URL(window.location.href);
      url.searchParams.set('lang', l);
      window.history.replaceState(null, '', url.toString());
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <LangContext.Provider value={{ lang, t: dict[lang], rtl: lang === 'he', setLang }}>{children}</LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
