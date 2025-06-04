import {
    Activity as WCIFActivity,
    Competition as WCIF,
    Event as WCIFEvent,
} from "@wca/helpers";

export interface UserInfo {
    username: string;
    fullName?: string;
    roles: UserRole[];
    wcaUserId?: number;
    wcaAccessToken?: string;
    avatarUrl?: string;
}

export interface PublicUser {
    id: string;
    fullName?: string;
    avatarUrl?: string;
}

export interface User extends PublicUser {
    username?: string;
    wcaUserId?: number;
    roles: string[];
    createdAt: Date;
    updatedAt: Date;
}

export interface INotification {
    id: string;
    message: string;
    type: "incident" | "info";
}

//eslint-disable-next-line
export enum UserRole {
    ADMIN = "ADMIN",
    DELEGATE = "DELEGATE",
    ORGANIZER = "ORGANIZER",
    STAGE_LEADER = "STAGE_LEADER",
    STAFF = "STAFF",
}

export interface CompetitionDataForLoginPage {
    id: string;
    wcaId: string;
    name: string;
    useFkmTimeDevices: boolean;
    countryIso2: string;
}

export interface Competition extends CompetitionDataForLoginPage {
    sendingResultsFrequency: SendingResultsFrequency;
    shouldChangeGroupsAutomatically: boolean;
    shouldUpdateDevices: boolean;
    scoretakingToken?: string;
    scoretakingTokenUpdatedAt?: Date;
    cubingContestsToken?: string;
    wifiSsid?: string;
    wifiPassword?: string;
    mdns?: boolean;
    wsUrl?: string;
    wcif: WCIF;
    createdAt?: Date;
    updatedAt?: Date;
    defaultLocale: string;
    hilTesting?: boolean;
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
    currentGroupIds: string[];
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
    attemptsByDevice: DeviceStatistics[];
    scorecardsCount: number;
    personsCompeted: number;
}

export interface EventStatistics {
    eventId: string;
    dnf: number;
    incidents: number;
    attempts: number;
}

export interface DeviceStatistics {
    deviceId: string;
    deviceName: string;
    count: number;
}

export interface RoundStatisticsByDay {
    id: number;
    date: Date;
    roundsStatistics: RoundStatistics[];
}

export interface RoundStatistics {
    roundId: string;
    roundName: string;
    delayInMinutes: number;
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
    status: StaffActivityStatus;
    isAssigned: boolean;
    createdAt: Date;
    updatedAt: Date;
}

//eslint-disable-next-line
export enum StaffActivityStatus {
    PRESENT = "PRESENT",
    ABSENT = "ABSENT",
    LATE = "LATE",
    REPLACED = "REPLACED",
}

export interface Result {
    id: string;
    eventId: string;
    roundId: string;
    groupId: string;
    createdAt: Date;
    updatedAt: Date;
    isDoubleChecked: boolean;
    doubleCheckedAt?: Date;
    doubleCheckedBy?: PublicUser;
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
    scramblerId?: string;
    scrambler?: Person;
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
    SCRAMBLED = "SCRAMBLED",
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

//eslint-disable-next-line
export enum IncidentAction {
    "RESOLVED" = "RESOLVED",
    "EXTRA_GIVEN" = "EXTRA_GIVEN",
}

export interface NoteworthyIncidentData {
    title: string;
    description?: string;
}

export interface NoteworthyIncident extends NoteworthyIncidentData {
    id: string;
    attempt?: Attempt;
    createdBy: User;
    createdAt: Date;
    updatedAt: Date;
}

export interface ManualIncidentData {
    personId: string;
    roundId: string;
    description: string;
    attempt?: string;
}

export interface ManualIncident extends ManualIncidentData {
    id: string;
    person: Person;
    round: Round;
    createdAt: Date;
    updatedAt: Date;
    createdBy: User;
}

export interface WarningData {
    description: string;
}

export interface Warning extends WarningData {
    id: string;
    createdBy: User;
    person: Person;
    createdAt: Date;
    updatedAt: Date;
}

export interface Device extends DeviceData {
    id: string;
    batteryPercentage?: number;
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

export interface DeviceData {
    name: string;
    espId: number;
    type: DeviceType;
    roomId: string;
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
    roles: UserRole[];
    wcaUserId?: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface QuickAction extends QuickActionData {
    id: string;
    user: User;
}

export interface QuickActionData {
    name: string;
    isShared: boolean;
    comment?: string;
    giveExtra: boolean;
}

export interface ApplicationQuickAction {
    id: string;
    name: string;
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
    usualScramblesCount?: number;
    usualExtraScramblesCount?: number;
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
    roles: string[];
    wcaId?: string;
}

export interface WCAPerson {
    name: string;
    wcaId: string;
    combinedName: string;
}

export interface ScramblingDevice extends ScramblingDeviceData {
    id: string;
    room: Room;
    createdAt: Date;
    updatedAt: Date;
}

export interface ScramblingDeviceData {
    name: string;
    roomId: string;
}

export interface ScrambleSet {
    id: string;
    roundId: string;
    set: string;
    scramblesCount: number;
    extraScramblesCount: number;
}

export interface Scramble {
    id: string;
    num: number;
    isExtra: boolean;
    encryptedScramble: string;
}

export interface DecryptedScramble {
    id: string;
    num: number;
    isExtra: boolean;
    scramble: string;
}

export interface ScrambleData {
    num: number;
    isExtra: boolean;
}

export interface ImportedScrambleSet {
    roundId: string;
    set: string;
    scrambles: ImportedScramble[];
}

export interface ImportedScramble {
    num: number;
    isExtra: boolean;
    encryptedScramble: string;
}

export interface Region {
    id: string;
    name: string;
    continentId: string;
    iso2: string;
}

export interface AttemptData {
    roundId: string;
    competitorId: string;
    type: AttemptType;
    status: AttemptStatus;
    judgeId?: string;
    scramblerId?: string;
    deviceId?: string;
    attemptNumber: number;
    value: number;
    penalty: number;
    comment: string;
    replacedBy: number;
}

export interface AvailableLocale {
    locale: string;
    localeName: string;
}

export interface MissedAssignments {
    person: Person;
    missedAssignments: StaffActivity[];
    missedAssignmentsCount: number;
}
