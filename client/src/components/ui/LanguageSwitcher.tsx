import React from 'react';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'hi', label: 'हिं' },
  { code: 'te', label: 'తె' },
];

export const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  return (
    <div className="flex gap-1 glass-subtle rounded-sm p-1">
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          onClick={() => i18n.changeLanguage(lang.code)}
          className={`px-2.5 py-1 text-[12px] font-medium rounded-xs transition-all duration-150 ${
            i18n.language === lang.code ? 'glass text-sky-900' : 'text-[#78716C]'
          }`}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
};
