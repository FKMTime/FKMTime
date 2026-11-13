import {
  getAllTranslations,
  getStationTranslations,
  STATION_TEXT_KEYS,
} from './translations';

describe('station translations', () => {
  // The firmware drops a websocket frame over WS_BUF_SIZE (8192 bytes), and
  // the device settings frame carries every locale plus a few other fields
  const FIRMWARE_FRAME_LIMIT = 8192;
  const OTHER_SETTINGS_FIELDS = 512;

  it('fits in one station frame, with room for the other settings', () => {
    const bytes = Buffer.byteLength(JSON.stringify(getStationTranslations()));

    expect(bytes + OTHER_SETTINGS_FIELDS).toBeLessThan(FIRMWARE_FRAME_LIMIT);
  });

  it('sends every station text in every locale and no reply messages', () => {
    for (const locale of getStationTranslations()) {
      expect(new Set(locale.translations.map((t) => t.key))).toEqual(
        STATION_TEXT_KEYS,
      );
    }
  });

  it('keeps reply messages for the backend, like the round-changed one', () => {
    const en = getAllTranslations().find((l) => l.locale === 'en');
    const station = getStationTranslations().find((l) => l.locale === 'en');

    expect(en.translations.map((t) => t.key)).toContain('stationRoundChanged');
    expect(station.translations.map((t) => t.key)).not.toContain(
      'stationRoundChanged',
    );
  });
});
