// 54Bank Accessibility Provider — WCAG 2.1 AA
import React, { createContext, useContext, useState, useEffect } from 'react';

interface A11ySettings {
  highContrast: boolean;
  fontSize: 'normal' | 'large' | 'xlarge';
  reducedMotion: boolean;
  screenReaderMode: boolean;
  keyboardNavigation: boolean;
}

const defaultSettings: A11ySettings = {
  highContrast: false,
  fontSize: 'normal',
  reducedMotion: false,
  screenReaderMode: false,
  keyboardNavigation: true,
};

const A11yContext = createContext<{
  settings: A11ySettings;
  updateSettings: (s: Partial<A11ySettings>) => void;
}>({ settings: defaultSettings, updateSettings: () => {} });

export function A11yProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<A11ySettings>(() => {
    const stored = localStorage.getItem('54bank_a11y');
    return stored ? JSON.parse(stored) : defaultSettings;
  });

  useEffect(() => {
    localStorage.setItem('54bank_a11y', JSON.stringify(settings));
    document.documentElement.classList.toggle('high-contrast', settings.highContrast);
    document.documentElement.classList.toggle('reduced-motion', settings.reducedMotion);
    document.documentElement.dataset.fontSize = settings.fontSize;
  }, [settings]);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (prefersReduced.matches) setSettings(s => ({ ...s, reducedMotion: true }));
  }, []);

  const updateSettings = (partial: Partial<A11ySettings>) => {
    setSettings(prev => ({ ...prev, ...partial }));
  };

  return (
    <A11yContext.Provider value={{ settings, updateSettings }}>
      {children}
    </A11yContext.Provider>
  );
}

export function useA11y() { return useContext(A11yContext); }

// Skip Navigation Link
export function SkipNavLink() {
  return (
    <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-white focus:text-black">
      Skip to main content
    </a>
  );
}

// Screen Reader Only Text
export function SrOnly({ children }: { children: React.ReactNode }) {
  return <span className="sr-only">{children}</span>;
}

// Live Region for dynamic announcements
export function LiveRegion({ message, assertive = false }: { message: string; assertive?: boolean }) {
  return (
    <div
      role={assertive ? "alert" : "status"}
      aria-live={assertive ? "assertive" : "polite"}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}
