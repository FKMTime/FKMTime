const translations = [
  {
    locale: 'en',
    translations: {
      stationNotFound: 'Station not found',
      competitorNotFound: 'Competitor not found',
      competitionNotFound: 'Competition not found',
      judgeNotFound: 'Judge not found',
      competitorIsNotInThisGroup: 'Competitor is not in this group',
      cutoffNotPassed: 'Cutoff not passed',
      delegateWasNotified: 'Delegate was notified',
      attemptEntered: 'Attempt entered',
      attemptEnteredButReplacedToDnf: 'Attempt entered but replaced to DNF',
      noAttemptsLeft: 'No attempts left',
      competitorIsNotSignedInForEvent: 'You are not signed for this event',
      attemptAlreadyEntered: 'This attempt has already been entered',
      alreadyCheckedIn: 'You have already checked in',
      attendanceConfirmed: 'Attendance confirmed',
    },
  },
  {
    locale: 'pl',
    translations: {
      stationNotFound: 'Stanowisko nie zostalo znalezione',
      competitorNotFound: 'Zawodnik nie zostal znaleziony',
      competitionNotFound: 'Zawody nie istnieja',
      judgeNotFound: 'Sedzia nie zostal znaleziony',
      competitorIsNotInThisGroup: 'Zawodnik nie jest w tej grupie',
      cutoffNotPassed: 'Nie zrobiles cutoffa',
      delegateWasNotified: 'Delegat został powiadomiony',
      attemptEntered: 'Ulozenie zostalo wprowadzona',
      attemptEnteredButReplacedToDnf:
        "Ulozenie zostalo wprowadzona, ale zastąpione DNF'em",
      noAttemptsLeft: 'Wykonales juz wszystkie ulozenia',
      competitorIsNotSignedInForEvent: 'Nie jestes zapisany na ta konkurencje',
      attemptAlreadyEntered: 'To ulozenie zostalo juz wprowadzone',
      alreadyCheckedIn: 'Twoja obecnosc zostala juz potwierdzona',
      attendanceConfirmed: 'Obecnosc zostala potwierdzona',
    },
  },
];

export const getTranslation = (key: string, locale: string) => {
  switch (locale.toLowerCase()) {
    case 'pl':
      return (
        translations.find((t) => t.locale === 'pl')?.translations[key] || key
      );
    default:
      return (
        translations.find((t) => t.locale === 'en')?.translations[key] || key
      );
  }
};

export const isLocaleAvailable = (locale: string) => {
  return translations.some((t) => t.locale === locale);
};

export const convertPolishToLatin = (text: string) => {
  const letters = [
    'ą',
    'ć',
    'ę',
    'ł',
    'ń',
    'ó',
    'ś',
    'ź',
    'ż',
    'Ą',
    'Ć',
    'Ę',
    'Ł',
    'Ń',
    'Ó',
    'Ś',
    'Ź',
    'Ż',
  ];
  const replacement = [
    'a',
    'c',
    'e',
    'l',
    'n',
    'o',
    's',
    'z',
    'z',
    'A',
    'C',
    'E',
    'L',
    'N',
    'O',
    'S',
    'Z',
    'Z',
  ];

  let result = text;

  for (let i = 0; i < letters.length; ++i) {
    result = result.replaceAll(letters[i], replacement[i]);
  }

  return result;
};
