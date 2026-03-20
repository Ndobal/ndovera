import React from 'react';
import { useI18n, Locale } from '../context/I18nContext';

const LanguageSwitcher: React.FC = () => {
  const { locale, setLocale } = useI18n();

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => setLocale(e.target.value as Locale);

  return (
    <select
      value={locale}
      onChange={onChange}
      style={{
        borderRadius: 999,
        padding: '0.35rem 0.7rem',
        border: '1px solid rgba(148,163,184,0.5)',
        background: 'rgba(15,23,42,0.9)',
        color: '#e5e7eb',
        fontSize: '0.72rem',
      }}
    >
      <option value="en">EN</option>
      <option value="fr">FR</option>
    </select>
  );
};

export default LanguageSwitcher;
