import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { AppLanguage } from '../types';
import { Translations } from './types';
import { en } from './translations/en';
import { ru } from './translations/ru';

export * from './types';

const translations: Record<AppLanguage, Translations> = {
  en,
  ru,
};

const STORAGE_KEY = '0xagent_language';

interface I18nContextType {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  t: Translations;
  formatString: (template: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

interface I18nProviderProps {
  children: React.ReactNode;
  initialLanguage?: AppLanguage | null;
  onLanguageChange?: (lang: AppLanguage) => void;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({
  children,
  initialLanguage,
  onLanguageChange,
}) => {
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY) as AppLanguage | null;
      if (stored === 'en' || stored === 'ru') {
        return stored;
      }
    }
    return initialLanguage || 'en';
  });

  // Sync if initialLanguage changes externally
  useEffect(() => {
    if (initialLanguage && (initialLanguage === 'en' || initialLanguage === 'ru')) {
      setLanguageState((prev) => {
        if (prev !== initialLanguage) {
          localStorage.setItem(STORAGE_KEY, initialLanguage);
          return initialLanguage;
        }
        return prev;
      });
    }
  }, [initialLanguage]);

  const setLanguage = useCallback((lang: AppLanguage) => {
    if (lang === 'en' || lang === 'ru') {
      setLanguageState(lang);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, lang);
      }
      onLanguageChange?.(lang);
    }
  }, [onLanguageChange]);

  const formatString = useCallback((template: string, params?: Record<string, string | number>): string => {
    if (!params) return template;
    let result = template;
    for (const [key, value] of Object.entries(params)) {
      result = result.split(`{${key}}`).join(String(value));
    }
    return result;
  }, []);

  const value = useMemo<I18nContextType>(() => ({
    language,
    setLanguage,
    t: translations[language] || translations.en,
    formatString,
  }), [language, setLanguage, formatString]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
};

export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);
  if (!context) {
    // Fallback if rendered outside provider
    return {
      language: 'en',
      setLanguage: () => {},
      t: en,
      formatString: (tmpl, params) => {
        if (!params) return tmpl;
        let res = tmpl;
        for (const [k, v] of Object.entries(params)) {
          res = res.split(`{${k}}`).join(String(v));
        }
        return res;
      },
    };
  }
  return context;
}
