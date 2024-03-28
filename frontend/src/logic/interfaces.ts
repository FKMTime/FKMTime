import { Competition as WCIF } from "@wca/helpers";

export interface UserInfo {
    username: string;
    role: string;
}

export interface Account {
    id: string;
    username: string;
    role: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface Competition {
    id: string;
    wcaId: string;
    name: string;
    sendResultsToWcaLive: boolean;
    shouldUpdateDevices: boolean;
    releaseChannel: ReleaseChannel;
    shortName: string;
    countryIso2: string;
    scoretakingToken?: string;
    scoretakingTokenUpdatedAt?: Date;
    wifiSsid?: string;
    wifiPassword?: string;
    wcif: WCIF;
    createdAt?: Date;
    updatedAt?: Date;
}

export enum ReleaseChannel {
    STABLE = "STABLE",
    PRE_RELEASE = "PRE_RELEASE",
}

export interface Room {
    id: string;
    name: string;
    currentGroupId: string;
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

export interface Attendance {
    id: string;
    groupId: string;
    person: Person;
    role: string;
    device: Device;
    createdAt: Date;
    updatedAt: Date;
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
    penalty: number;
    status: AttemptStatus;
    inspectionTime?: number;
    solvedAt: Date;
    value: number;
    judgeId: string;
    judge: Person;
    device: Device;
}

export enum AttemptStatus {
    STANDARD_ATTEMPT = "STANDARD_ATTEMPT",
    EXTRA_ATTEMPT = "EXTRA_ATTEMPT",
    UNRESOLVED = "UNRESOLVED",
    RESOLVED = "RESOLVED",
    EXTRA_GIVEN = "EXTRA_GIVEN",
}

export interface Incident extends Attempt {
    result: Result;
    shouldResubmitToWcaLive: boolean;
}

export interface Device {
    id: string;
    name: string;
    espId: number;
    type: DeviceType;
    batteryPercentage?: number;
    roomId: string;
    room: Room;
    count?: number;
    createdAt: Date;
    updatedAt: Date;
}

export enum DeviceType {
    STATION = "STATION",
    ATTENDANCE = "ATTENDANCE",
}

export interface Settings {
    username: string;
    role: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface GroupAssigment {
    groupId: number;
    activityCode: string;
    groupName: string;
    activityName: string;
}

export interface SelectOption {
    value: string;
    label: string;
}
