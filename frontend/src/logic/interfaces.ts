import {
    Activity as WCIFActivity,
    Competition as WCIF,
    Event as WCIFEvent,
} from "@wca/helpers";

export interface UserInfo {
    username: string;
    fullName?: string;
    role: UserRole;
    wcaUserId?: number;
    wcaAccessToken?: string;
    isWcaAdmin: boolean;
}

export interface User {
    id: string;
    username?: string;
    wcaUserId?: number;
    wcaId?: string;
    isWcaAdmin: boolean;
    fullName?: string;
    role: string;
    createdAt?: Date;
    updatedAt?: Date;
}

//eslint-disable-next-line
export enum UserRole {
    ADMIN = "ADMIN",
    STAFF = "STAFF",
}

export interface Competition {
    id: string;
    wcaId: string;
    name: string;
    sendingResultsFrequency: SendingResultsFrequency;
    shouldChangeGroupsAutomatically: boolean;
    shouldUpdateDevices: boolean;
    countryIso2: string;
    scoretakingToken?: string;
    scoretakingTokenUpdatedAt?: Date;
    cubingContestsToken?: string;
    wifiSsid?: string;
    wifiPassword?: string;
    wcif: WCIF;
    createdAt?: Date;
    updatedAt?: Date;
}

//eslint-disable-next-line
export enum SendingResultsFrequency {
    AFTER_SOLVE = "AFTER_SOLVE",
    EVERY_5_MINUTES = "EVERY_5_MINUTES",
    NEVER = "NEVER",
}
export interface Activity extends WCIFActivity {
    realStartTime?: Date;
    realEndTime?: Date;
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
    checkedInAt?: Date;
}

export interface CompetitionStatistics {
    allAttempts: number;
    attemptsEnteredManually: number;
    byEventStats: EventStatistics[];
    byRoundStats: RoundStatisticsByDay[];
    scorecardsCount: number;
    personsCompeted: number;
}

export interface EventStatistics {
    eventId: string;
    dnf: number;
    incidents: number;
    attempts: number;
}

export interface RoundStatisticsByDay {
    date: Date;
    roundsStatistics: RoundStatistics[];
}

export interface RoundStatistics {
    roundId: string;
    roundName: string;
    delayInSeconds: number;
}

export interface AttendanceStatistics {
    personName: string;
    presentPercentage: number;
    totalAssignedStaffing: number;
    totalPresentAtStaffingComparedToRounds: number;
    totalStaffingComparedToRounds: number;
}

export interface StaffActivity {
    id: string;
    groupId: string;
    person: Person;
    role: string;
    device: Device;
    isPresent: boolean;
    isAssigned: boolean;
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

export interface ResultToDoubleCheck extends Result {
    combinedName: string;
}

export interface ResultWithAverage extends Result {
    average: number;
    best: number;
    averageString: string;
    bestString: string;
}

export interface Attempt {
    id: string;
    resultId: number;
    attemptNumber: number;
    comment?: string;
    replacedBy: number;
    penalty: number;
    status: AttemptStatus;
    type: AttemptType;
    inspectionTime?: number;
    solvedAt: Date;
    value: number;
    originalTime?: number;
    sessionId?: string;
    judgeId?: string;
    judge?: Person;
    deviceId?: string;
    device?: Device;
    updatedBy?: User;
}

//eslint-disable-next-line
export enum AttemptStatus {
    STANDARD = "STANDARD",
    UNRESOLVED = "UNRESOLVED",
    RESOLVED = "RESOLVED",
    EXTRA_GIVEN = "EXTRA_GIVEN",
}

//eslint-disable-next-line
export enum AttemptType {
    STANDARD_ATTEMPT = "STANDARD_ATTEMPT",
    EXTRA_ATTEMPT = "EXTRA_ATTEMPT",
}

export interface Incident extends Attempt {
    result: Result;
    updateReplacedBy?: boolean;
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

//eslint-disable-next-line
export enum DeviceType {
    STATION = "STATION",
    ATTENDANCE_SCRAMBLER = "ATTENDANCE_SCRAMBLER",
    ATTENDANCE_RUNNER = "ATTENDANCE_RUNNER",
}

export interface AvailableDevice {
    espId: number;
    type: AvailableDeviceType;
}

//eslint-disable-next-line
export enum AvailableDeviceType {
    STATION = "STATION",
    STAFF_ATTENDANCE = "STAFF_ATTENDANCE",
}

export interface Settings {
    username: string;
    role: UserRole;
    wcaUserId?: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface QuickAction {
    id: string;
    name: string;
    user: User;
    isShared: boolean;
    comment?: string;
    giveExtra: boolean;
}

export interface WCACompetition {
    id: string;
    name: string;
    url: string;
    country_iso2: string;
    registration_open: string;
    start_date: string;
}

export interface Event {
    id: string;
    name: string;
    shortName?: string;
    icon: string;
    useInspection?: boolean;
    isUnofficial?: boolean;
}

export interface UnofficialEvent {
    id: string;
    eventId: string;
    wcif: WCIFEvent;
    createdAt: Date;
    updatedAt: Date;
}

export interface GroupedIncidents {
    category: string;
    incidents: Incident[];
}

export interface AddPerson {
    name: string;
    wcaId?: string;
    countryIso2?: string;
    cardId?: string;
    canCompete: boolean;
    gender: string;
}

export interface NewUserData {
    username?: string;
    password?: string;
    fullName: string;
    role: UserRole;
    wcaId?: string;
}

export interface WCAPerson {
    name: string;
    wcaId: string;
    combinedName: string;
}
