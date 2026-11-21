import { HardwareVersion } from './generated/prisma/client';

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

// A WCIF round id such as 333-r1. Anchored: it ends up in URL paths sent to the WCA
export const roundIdRegex = '^[a-zA-Z0-9_]+-r\\d+$';
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
export const ADMIN_WCA_USER_IDS = [259132, 470248, 244611];
export const SHOW_SECONDARY_TEXT_HW_VERSIONS: HardwareVersion[] = [
  HardwareVersion.V4,
];

/**
 * Attempt fields only delegates read: their notes on rulings and incidents, who
 * last changed the attempt, and the raw timer readings. Left out wherever
 * results are shown to anyone else.
 */
export const delegateOnlyAttemptFields = {
  comment: true,
  updatedById: true,
  originalTime: true,
  inspectionTime: true,
} as const;
