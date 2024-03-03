import { Competition as WCIF } from "@wca/helpers";

export interface UserInfo {
  username: string;
  role: string;
}

export interface Account {
  id: number;
  username: string;
  role: string;
  email: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Competition {
  id: number;
  wcaId: string;
  name: string;
  usesWcaProduction: boolean;
  shouldCheckGroup: boolean;
  shouldUpdateDevices: boolean;
  shortName: string;
  countryIso2: string;
  currentGroupId?: string;
  scoretakingToken?: string;
  wcif: WCIF;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Person {
  id: number;
  registrantId: number;
  name: string;
  wcaId?: string;
  countryIso2?: string;
  gender: string;
  cardId?: string;
  giftpackCollectedAt?: Date;
}

export interface Result {
  id: number;
  eventId: string;
  roundId: string;
  groupId: string;
  createdAt: Date;
  updatedAt: Date;
  person: Person;
  attempts: Attempt[];
}

export interface Attempt {
  id: number;
  resultId: number;
  attemptNumber: number;
  comment?: string;
  replacedBy: number;
  isDelegate: boolean;
  isResolved: boolean;
  penalty: number;
  isExtraAttempt: boolean;
  extraGiven: boolean;
  solvedAt: Date;
  value: number;
  judgeId: number;
  judge: Person;
  station: Station;
}

export interface Station {
  id: number;
  name: string;
  espId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Settings {
  username: string;
  email: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupAssigment {
  groupId: number;
  groupName: string;
  activityName: string;
}