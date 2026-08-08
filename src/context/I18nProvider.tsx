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
    let value: any = translations[locale];
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Fallback to English if not found in current locale
        value = translations.en;
        for (const k2 of keys) {
          if (value && typeof value === 'object' && k2 in value) {
            value = value[k2];
          } else {
            return key; // Return the key itself if not found
          }
        }
        break;
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