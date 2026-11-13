/** Where official results go; unofficial events always go to Cubing Contests */
export type OfficialResultsDestination =
  'WCA_LIVE' | 'WCA_INTEGRATED_LIVE' | 'NONE';

/**
 * Follows the competition's scoretaking software on the WCA website
 * (SPEC-006): the WCA only takes results from the tool it names, so there is
 * no choice of our own that could disagree with it.
 */
export const getOfficialResultsDestination = (competition: {
  wcaScoretakingSoftware: string | null;
  scoretakingToken: string | null;
}): OfficialResultsDestination => {
  switch (competition.wcaScoretakingSoftware) {
    case 'wca_live':
      return 'WCA_LIVE';
    case 'internal':
      return 'WCA_INTEGRATED_LIVE';
    case null:
      // Not read yet: behave as before following the WCA setting
      return competition.scoretakingToken ? 'WCA_LIVE' : 'NONE';
    default:
      // 'external', or a value the WCA added since
      return 'NONE';
  }
};
