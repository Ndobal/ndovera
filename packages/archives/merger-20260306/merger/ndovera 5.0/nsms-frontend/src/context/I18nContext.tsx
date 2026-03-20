import React, { createContext, useContext, useEffect, useState } from 'react';

export type Locale = 'en' | 'fr';

const translations = {
  en: {
    dashboard: 'Dashboard',
    login: 'Login',
    signup: 'Sign up',
    welcomeOwner: 'Welcome, School Owner',
    welcomeHOS: 'Welcome, Head of School',
    welcomeTeacher: 'Welcome, Teacher',
    welcomeStaff: 'Welcome, Staff',
    welcomeStudent: 'Welcome, Student',
    welcomeParent: 'Welcome, Parent/Guardian',
  },
  fr: {
    dashboard: 'Tableau de bord',
    login: 'Connexion',
    signup: "S'inscrire",
    welcomeOwner: "Bienvenue, Propriétaire de l'école",
    welcomeHOS: "Bienvenue, Chef d'établissement",
    welcomeTeacher: 'Bienvenue, Enseignant',
    welcomeStaff: 'Bienvenue, Personnel',
    welcomeStudent: 'Bienvenue, Élève',
    welcomeParent: 'Bienvenue, Parent/Tuteur',
  },
} as const;

type Messages = (typeof translations)[Locale];
type TranslationKey = keyof (typeof translations)['en'];

interface I18nContextValue {
  locale: Locale;
  t: (key: TranslationKey) => string;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export const I18nProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    const stored = window.localStorage.getItem('nsms-locale') as Locale | null;
    if (stored === 'en' || stored === 'fr') setLocaleState(stored);
  }, []);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem('nsms-locale', next);
  };

  const t = (key: TranslationKey) => translations[locale][key] ?? key;

  return <I18nContext.Provider value={{ locale, t, setLocale }}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextValue => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
};
