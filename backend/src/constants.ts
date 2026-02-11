import { Attempt } from '@prisma/client';

export const SKIPPED_VALUE = 0;
export const DNF_VALUE = -1;
export const DNS_VALUE = -2;

export interface ResultWithAttempts {
  roundId: string;
  attempts: Attempt[];
  person: PublicPerson;
}

export interface PublicPerson {
  id: string;
  name: string;
  wcaId: string;
  registrantId: number;
  countryIso2: string;
  canCompete: boolean;
}

export const publicPersonSelect = {
  select: {
    id: true,
    name: true,
    wcaId: true,
    registrantId: true,
    countryIso2: true,
    canCompete: true,
  },
};

export const publicUserSelect = {
  select: {
    id: true,
    fullName: true,
    avatarUrl: true,
  },
};

export const roundIdRegex = '.*-r\\d+';
export const groupIdRegex = '.*-r\\d+-g\\d+';

export const roundFormatMap = {
  '1': 1,
  '2': 2,
  '3': 3,
  '5': 5,
  a: 5,
  m: 3,
};

//FKMTime developers are always allowed to log in using their WCA accounts
export const ADMIN_WCA_USER_IDS = [259132, 470248];
