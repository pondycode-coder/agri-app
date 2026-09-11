import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { translations, Locale } from '../i18n/translations';

interface I18nContextType {
  locale: Locale;
  t: (key: string) => string;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocale] = useState<Locale>(() => {
    // Try to get from localStorage
    const saved = localStorage.getItem('locale') as Locale | null;
    if (saved && (saved === 'fr' || saved === 'en')) {
      return saved;
    }
    // Default to French
    return 'fr';
  });

  // Save to localStorage when locale changes
  useEffect(() => {
    localStorage.setItem('locale', locale);
  }, [locale]);

  const t = (key: string): string => {
    const keys = key.split('.');
    const resolve = (dict: Record<string, unknown>): string | null => {
      let value: Record<string, unknown> | string | undefined = dict;
      for (let i = 0; i < keys.length; i++) {
        // Allow flattened keys nested one level deep, e.g. help['plots.1']
        const joined = keys.slice(i).join('.');
        if (value && typeof value === 'object' && joined in value) {
          const v = (value as Record<string, unknown>)[joined];
          if (typeof v === 'string') return v;
        }
        const k = keys[i];
        if (value && typeof value === 'object' && k in value) {
          value = (value as Record<string, unknown>)[k] as Record<string, unknown> | string | undefined;
        } else {
          return null;
        }
      }
      return typeof value === 'string' ? value : null;
    };
    const local = resolve(translations[locale] as Record<string, unknown>);
    if (local) return local;
    const fallback = resolve(translations.en as Record<string, unknown>);
    return fallback ?? key; // Return the key itself if not found
  };

  return (
    <I18nContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
};