import * as fs from 'fs';
import * as path from 'path';

const locales = [
  {
    locale: 'en',
    localeName: 'English',
  },
  {
    locale: 'pl',
    localeName: 'Polish',
  },
];

export const getTranslation = (key: string, locale: string) => {
  const translations = getTranslationsJSON(locale)?.translations;
  if (!translations) return key;
  return translations.find((t) => t.key === key)?.translation ?? key;
};

export const getTranslationsJSON = (locale: string) => {
  const filePath = path.join(__dirname, 'locales', `${locale}.json`);
  const rawData = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(rawData);
};

export const getAllTranslations = () => {
  return locales.map((l) => {
    return {
      locale: l.locale,
      translations: getTranslationsJSON(l.locale)?.translations,
    };
  });
};

export const isLocaleAvailable = (locale: string) => {
  return locales.some((l) => l.locale === locale);
};

export const getLocales = () => {
  return locales;
};

export const convertToLatin = (text: string) => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L');
};
