import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
interface ThemeState { theme: Theme; toggle: () => void; }
const Ctx = createContext<ThemeState>(null as any);

const lightVars: Record<string,string> = {
  '--bg':'#ffffff', '--fg':'#111111', '--accent':'#2563eb', '--panel':'#f5f7fa'
};
const darkVars: Record<string,string> = {
  '--bg':'#0f172a', '--fg':'#f1f5f9', '--accent':'#3b82f6', '--panel':'#1e293b'
};

function applyTheme(t: Theme) {
  const root = document.documentElement;
  const vars = t==='dark'? darkVars : lightVars;
  Object.entries(vars).forEach(([k,v])=> root.style.setProperty(k,v));
  root.setAttribute('data-theme', t);
  // Tailwind dark mode bridging
  if (t === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
}

export const ThemeProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'light');
  useEffect(()=>{ applyTheme(theme); localStorage.setItem('theme', theme); }, [theme]);
  function toggle() { setTheme(t => t==='light'? 'dark':'light'); }
  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>;
};

export const useTheme = () => useContext(Ctx);
