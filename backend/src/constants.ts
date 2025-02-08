export const SKIPPED_VALUE = 0;
export const DNF_VALUE = -1;
export const DNS_VALUE = -2;

export const publicPersonSelect = {
  select: {
    id: true,
    name: true,
    wcaId: true,
    registrantId: true,
    countryIso2: true,
  },
};

export const roundIdRegex = '.*-r\\d+';
export const groupIdRegex = '.*-r\\d+-g\\d+';
