import type { ReactNode } from 'react';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
// import { useTenant } from './TenantContext';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // const { tenant } = useTenant();
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('themeMode');
    return (saved as ThemeMode) || 'system';
  });

  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkTheme = () => {
      if (themeMode === 'dark') {
        setIsDark(true);
      } else if (themeMode === 'light') {
        setIsDark(false);
      } else {
        // System preference
        setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
      }
    };

    checkTheme();

    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => checkTheme();
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [themeMode]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    
    // Don't override tenant colors - let TenantContext handle all color variables
    // This effect only handles the dark mode class toggle
    // TenantContext will re-apply colors after theme changes
  }, [isDark]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem('themeMode', mode);
  }, []);

  const value = useMemo(
    () => ({ themeMode, setThemeMode, isDark }),
    [themeMode, setThemeMode, isDark]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
