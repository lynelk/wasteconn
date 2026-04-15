import { useEffect } from 'react';

export default function ThemeProvider({ children }) {
  useEffect(() => {
    const applyTheme = (dark) => {
      document.documentElement.classList.toggle('dark', dark);
    };

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    applyTheme(mediaQuery.matches);

    const handler = (e) => applyTheme(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return children;
}