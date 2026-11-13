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
  let localeToUse = locale;
  const availableLocales = getAvailableLocales();
  if (!availableLocales.some((l) => l.locale === locale)) {
    localeToUse = 'en';
  }
  const translations = getTranslationsJSON(localeToUse)?.translations;
  if (!translations) return key;
  return translations.find((t) => t.key === key)?.translation ?? key;
};

export const getTranslationsJSON = (locale: string) => {
  const localesPath = getLocalesPath();
  const filePath = path.join(localesPath, `${locale.toLowerCase()}.json`);

  try {
    const rawData = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(rawData);
  } catch (error) {
    console.error(`Failed to load translations for locale: ${locale}`, error);
    return null;
  }
};

/**
 * Texts the station firmware shows itself (its src/default_translation.json).
 * Every other text here is a reply message the backend fills in, so it never
 * needs to reach a station.
 */
export const STATION_TEXT_KEYS = new Set([
  'scanCompetitorCardHeader',
  'scanCompetitorCardFooter',
  'scanCompetitorCardWithTimeFooter',
  'selectGroup',
  'confirmTime',
  'scanJudgeCard',
  'scanCompetitorCard',
  'waitingForWifiHeader',
  'waitingForWifiFooter',
  'waitingForMdnsHeader',
  'waitingForMdnsFooter',
  'wifiSetupHeader',
  'callingForDelegateHeader',
  'callingForDelegateFooter',
  'waitingForDelegateHeader',
  'waitingForDelegateFooter',
  'errorHeader',
  'deviceNotAddedHeader',
  'deviceNotAddedFooter',
  'emptyGroupsError',
  'serverDisconnectedHeader',
  'stackmatDisconnectedHeader',
  'stackmatDisconnectedFooter',
  'serverDisconnectedFooter',
  'inspection',
  'cardsCannotBeTheSameHeader',
  'cardsCannotBeTheSameFooter',
  'sleep',
  'deepSleep',
  'pressAnyKey',
  'configMenu',
  'scanTheCard',
  'unpair',
  'exit',
  'resetAttemptHeader',
  'resetAttemptFooter',
  'sendingHeader',
  'sendingFooter',
  'resetTimerHeader',
  'resetTimerFooter',
]);

/**
 * The station receives every locale in one websocket frame, and the firmware
 * drops a frame over WS_BUF_SIZE (8192 bytes): the station then never learns
 * whether it is added, or its texts. So only the texts it shows go out.
 */
export const getStationTranslations = () =>
  getAllTranslations().map((l) => ({
    locale: l.locale,
    translations: l.translations?.filter((t: { key: string }) =>
      STATION_TEXT_KEYS.has(t.key),
    ),
  }));

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
