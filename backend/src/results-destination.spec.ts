import { getOfficialResultsDestination } from './results-destination';

describe('getOfficialResultsDestination', () => {
  it.each([
    ['wca_live', null, 'WCA_LIVE'],
    ['wca_live', 'token', 'WCA_LIVE'],
    ['internal', 'token', 'WCA_INTEGRATED_LIVE'],
    ['external', 'token', 'NONE'],
    ['something_new', 'token', 'NONE'],
  ])(
    'follows the WCA setting %s (token %s) to %s',
    (wcaScoretakingSoftware, scoretakingToken, expected) => {
      expect(
        getOfficialResultsDestination({
          wcaScoretakingSoftware,
          scoretakingToken,
        }),
      ).toBe(expected);
    },
  );

  it('sends to WCA Live before the first read when a token is set', () => {
    expect(
      getOfficialResultsDestination({
        wcaScoretakingSoftware: null,
        scoretakingToken: 'token',
      }),
    ).toBe('WCA_LIVE');
  });

  it('sends nowhere before the first read without a token', () => {
    expect(
      getOfficialResultsDestination({
        wcaScoretakingSoftware: null,
        scoretakingToken: null,
      }),
    ).toBe('NONE');
  });
});
