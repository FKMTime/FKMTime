import * as fs from 'fs';
import * as path from 'path';

const getLocalesPath = () => {
  const rootPath = process.cwd();
  const possiblePaths = [
    path.join(rootPath, 'translations', 'locales'),
    path.join(rootPath, 'src', 'translations', 'locales'),
  ];

  for (const ppath of possiblePaths) {
    if (fs.existsSync(ppath)) {
      return ppath;
    }
  }

  throw new Error(
    'Locales directory not found in any of the expected locations',
  );
};

const getAvailableLocales = () => {
  const localesPath = getLocalesPath();
  const files = fs.readdirSync(localesPath);

  return files
    .filter((file) => file.endsWith('.json'))
    .map((file) => ({
      locale: path.parse(file).name,
      localeName: path.parse(file).name.toLowerCase(),
    }));
};

export const getTranslation = (key: string, locale: string) => {
  const translations = getTranslationsJSON(locale)?.translations;
  if (!translations) return key;
  return translations.find((t) => t.key === key)?.translation ?? key;
};

export const getTranslationsJSON = (locale: string) => {
  const localesPath = getLocalesPath();
  const filePath = path.join(localesPath, `${locale}.json`);

  try {
    const rawData = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(rawData);
  } catch (error) {
    console.error(`Failed to load translations for locale: ${locale}`, error);
    return null;
  }
};

export const getAllTranslations = () => {
  const locales = getAvailableLocales();
  return locales.map((l) => ({
    locale: l.locale,
    translations: getTranslationsJSON(l.locale)?.translations,
  }));
};

export const isLocaleAvailable = (locale: string) => {
  const locales = getAvailableLocales();
  return locales.some((l) => l.locale === locale);
};

export const getLocales = () => {
  return getAvailableLocales();
};

export const convertToLatin = (text: string) => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L');
};
