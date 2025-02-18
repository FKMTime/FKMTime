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

//FKMTime developers are always allowed to log in using their WCA accounts
export const ADMIN_WCA_USER_IDS = [259132, 470248];
