export interface Competition {
  id: number;
  wcaId: string;
  name: string;
  shortName: string;
  countryIso2: string;
  currentGroupId?: string;
  scoretakingToken?: string;
  //eslint-disable-next-line
  wcif: any;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Attempt {
  id: number;
  resultId: number;
  attemptNumber: number;
  replacedBy: number;
  isDelegate: boolean;
  isResolved: boolean;
  penalty: number;
  isExtraAttempt: boolean;
  extraGiven: boolean;
  solvedAt: Date;
  value: number;
  judge: Person;
  station: Station;
  result: Result;
}

export interface Station {
  id: number;
  name: string;
  espId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Person {
  id: number;
  registrantId: number;
  name: string;
  wcaId?: string;
  countryIso2?: string;
  gender: string;
  cardId?: string;
}

export interface Result {
  id: number;
  eventId: string;
  roundId: string;
  groupId: string;
  createdAt: Date;
  updatedAt: Date;
  person: Person;
}
