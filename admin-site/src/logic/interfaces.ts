import { Competition as WCIF } from "@wca/helpers";

export interface UserInfo {
    username: string;
    role: string;
}

export interface Account {
    id: string;
    username: string;
    role: string;
    email: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface Competition {
    id: string;
    wcaId: string;
    name: string;
    usesWcaProduction: boolean;
    shouldUpdateDevices: boolean;
    useStableReleases: boolean;
    shortName: string;
    countryIso2: string;
    scoretakingToken?: string;
    wcif: WCIF;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface Room {
    id: string;
    name: string;
    currentRoundId: string;
    color: string;
}

export interface Round {
    id: string;
    name: string;
}

export interface Person {
    id: string;
    registrantId?: number;
    canCompete: boolean;
    name: string;
    wcaId?: string;
    countryIso2?: string;
    gender: string;
    birthdate?: Date;
    cardId?: string;
    giftpackCollectedAt?: Date;
}

export interface Result {
    id: string;
    eventId: string;
    roundId: string;
    groupId: string;
    createdAt: Date;
    updatedAt: Date;
    person: Person;
    attempts: Attempt[];
}

export interface Attempt {
    id: string;
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
    id: string;
    name: string;
    espId: string;
    roomId: string;
    room: Room;
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
