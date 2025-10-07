import React, { createContext, useContext, useState, useCallback } from 'react';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - json module resolution
import en from './en.json';

type Catalog = Record<string,string>;
const catalogs: Record<string, Catalog> = { en };

interface I18nState { t: (k:string, vars?:Record<string,string|number>)=>string; locale: string; setLocale: (l:string)=>void; }
const Ctx = createContext<I18nState>(null as any);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocale] = useState('en');
  const t = useCallback((k:string, vars?:Record<string,string|number>) => {
    const base = catalogs[locale]?.[k] || k;
    if (!vars) return base;
    return Object.entries(vars).reduce((acc,[kv,v]) => acc.replace(new RegExp(`{${kv}}`,'g'), String(v)), base);
  }, [locale]);
  return <Ctx.Provider value={{ t, locale, setLocale }}>{children}</Ctx.Provider>;
};

export function useT() { return useContext(Ctx).t; }