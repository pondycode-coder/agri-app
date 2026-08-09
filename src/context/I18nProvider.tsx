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
    // Split the key by dots and traverse the translations object
    const keys = key.split('.');
    let value: Record<string, unknown> | string = translations[locale] as Record<string, unknown>;
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k] as Record<string, unknown> | string;
      } else {
        // Fallback to English if not found in current locale
        let fallback: Record<string, unknown> | string = translations.en as Record<string, unknown>;
        for (const k2 of keys) {
          if (fallback && typeof fallback === 'object' && k2 in fallback) {
            fallback = fallback[k2] as Record<string, unknown> | string;
          } else {
            return key; // Return the key itself if not found
          }
        }
        return typeof fallback === 'string' ? fallback : key;
      }
    }
    return typeof value === 'string' ? value : key;
  };

  return (
    <I18nContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
};