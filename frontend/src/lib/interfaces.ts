import {
    Activity as WCIFActivity,
    Competition as WCIF,
    Event as WCIFEvent,
} from "wcif-helpers";

export interface UserInfo {
    id?: string;
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
    /** A stage lead's rooms; none means all rooms (SPEC-016) */
    stageLeadRoomIds?: string[];
    createdAt: Date;
    updatedAt: Date;
}

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
    fkmToken: number;
    secureRfid: boolean;
    soundEnabled: boolean;
    buzzerVolume: number | null;
    /** How the WCA website says results are entered; null until first read */
    wcaScoretakingSoftware?: string | null;
    wcaScoretakingCheckedAt?: string | null;
    officialResultsDestination?: OfficialResultsDestination;
    integratedLiveConnection?: IntegratedLiveConnectionState;
    openRoundsAutomatically?: boolean;
}

/** A round as WCA Integrated Live Results has it */
export interface IntegratedLiveRound {
    roundId: string;
    /** pending, blocked, ready, open or locked */
    state: string;
    totalCompetitors?: number;
    completedCompetitors?: number;
    competitorCountNeeded?: number;
    /** The round strip's dot: the WCA state, or needs attention */
    dot?: "notOpen" | "open" | "done" | "attention";
    /** Results the WCA won't take until someone acts */
    needsAttention?: number;
}

export type IntegratedLiveSyncStatus =
    | "DIRTY"
    | "SENT"
    | "CONFIRMED"
    | "NOT_IN_ROUND"
    | "NOT_SENDABLE"
    | "REJECTED";

/** One FKMTime result next to the WCA's copy of it */
export interface IntegratedLiveResultView {
    resultId: string;
    personId: string;
    registrationId: number | null;
    status: IntegratedLiveSyncStatus | null;
    error: string | null;
    sentAt: string | null;
    advancing: "advances" | "mayAdvance" | null;
    /** The WCA's attempts (centiseconds, -1 DNF, -2 DNS), null if none */
    wcaAttempts: number[] | null;
    /** The WCA holds other attempts, and nothing is on its way */
    differs: boolean;
}

/** Rounds with results that aren't getting through, for Home's alert */
export interface IntegratedLiveProblems {
    /** On their way for more than a few minutes */
    stuck: { roundId: string; count: number }[];
    /** Refused by the WCA, or not in its round */
    refused: { roundId: string; count: number }[];
}

/** What the WCA says about adding events and on-site registration */
export interface IntegratedLiveRegistrationRules {
    eventChangeDeadline: string | null;
    onTheSpotRegistration: boolean;
    competitorLimit: number | null;
}

/** A WCA user who may enter results for the competition */
export interface IntegratedLiveScoretaker {
    wcaUserId: number;
    name: string;
}

export interface IntegratedLiveScoretakers {
    ok: boolean;
    scoretakers: IntegratedLiveScoretaker[];
    message?: string;
    needsWcaSignIn?: boolean;
}

/** A result the WCA holds that FKMTime has no result for */
export interface IntegratedLiveOnlyInWca {
    registrationId: number;
    name: string | null;
    wcaId: string | null;
    attempts: number[];
}

export interface IntegratedLiveRoundDetails {
    roundId: string;
    state: string;
    totalCompetitors: number | null;
    completedCompetitors: number | null;
    waitingReason: string | null;
    onTheWay: number;
    needsAttention: number;
    results: IntegratedLiveResultView[];
    onlyInWca: IntegratedLiveOnlyInWca[];
}

export interface IntegratedLiveNoShows {
    roundId: string;
    competitors: { personId: string; name: string; registrationId: number }[];
}

export interface IntegratedLiveNextInLine {
    registrationId: number;
    name: string | null;
    personId: string | null;
}

export interface IntegratedLiveWithdrawalPreview {
    ok: boolean;
    message?: string;
    name?: string;
    roundOpen?: boolean;
    roundState?: string | null;
    next?: IntegratedLiveNextInLine[];
    nobodyReason?: string | null;
}

export interface IntegratedLiveWithdrawalResult {
    ok: boolean;
    message: string;
    changed?: boolean;
    next?: IntegratedLiveNextInLine[];
    replacements?: {
        personId: string;
        name: string;
        suggestedGroupId: string | null;
    }[];
}

export interface IntegratedLiveAddableCompetitor {
    registrationId: number;
    name: string | null;
    wcaId: string | null;
}

export type IntegratedLiveConnectionState =
    | "NOT_CONNECTED"
    | "CONNECTED"
    | "BROKEN";

export interface IntegratedLiveConnectionStatus {
    state: IntegratedLiveConnectionState;
    /** The WCA account results are entered as */
    connectedAs: string | null;
    /** Null when the WCA couldn't tell at connect time */
    canEnterScores: boolean | null;
    brokenAt: string | null;
    usesIntegratedLive: boolean;
}

export interface ScoretakingSoftwareStatus {
    wcaScoretakingSoftware: string | null;
    wcaScoretakingCheckedAt: string | null;
    officialResultsDestination: OfficialResultsDestination;
}

/** Where official results go, following the WCA setting (SPEC-006) */
export type OfficialResultsDestination =
    | "WCA_LIVE"
    | "WCA_INTEGRATED_LIVE"
    | "NONE";

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

/** Stations of a room pointed at another round, as the scrambling device sees them */
export interface StationRound {
    roundId: string;
    stationNames: string[];
}

/** The scrambling device's room, with its stations running other rounds */
export interface ScramblingDeviceRoom extends Room {
    stationRounds?: StationRound[];
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

export interface JudgeRankingEntry {
    personName: string;
    count: number;
    topCompetitorCount?: number;
    topCompetitorName?: string;
}

export interface SuspiciousAverage {
    competitorName: string;
    roundName: string;
    judgeName?: string;
    stationName?: string;
    attemptCount: number;
}

export interface CompetitionStatistics {
    allAttempts: number;
    attemptsEnteredManually: number;
    extraAttemptsUsed: number;
    judgeRanking: JudgeRankingEntry[];
    scramblerRanking: JudgeRankingEntry[];
    suspiciousAverages: SuspiciousAverage[];
    byEventStats: EventStatistics[];
    byRoundStats: RoundStatisticsByDay[];
    byRoundAttemptStats: RoundAttemptStatistics[];
    attemptsByDevice: DeviceStatistics[];
    scorecardsCount: number;
    personsCompeted: number;
}

export interface RoundAttemptStatistics {
    roundId: string;
    solves: number;
    manual: number;
    extras: number;
    dnf: number;
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

/** Every staff role but competing, which isn't staffing */
export type StaffingRole =
    | "JUDGE"
    | "SCRAMBLER"
    | "RUNNER"
    | "DELEGATE"
    | "STAFF_OTHER";

/** Counts over groups that happened; mirrors backend attendanceStatistics.ts */
export interface AttendanceSummary {
    /** covered / expected × 100; null while nothing assigned has happened */
    attendancePct: number | null;
    /** Assigned slots done by the person themselves: present or late */
    covered: number;
    expected: number;
    /** Part of covered */
    late: number;
    replaced: number;
    absent: number;
    leftEarly: number;
    /** Part of absent */
    noShows: number;
    /** Present without an assignment; outside the percentage */
    extraHelp: number;
}

export interface PersonAttendance {
    personId: string;
    personName: string;
    roles: StaffingRole[];
    assigned: number;
    /** Present or late, so late is part of it */
    present: number;
    late: number;
    absent: number;
    replaced: number;
    leftEarly: number;
    noShow: number;
    extraHelp: number;
    attendancePct: number | null;
}

export interface RoundAttendance {
    roundId: string;
    roundName: string;
    expected: number;
    covered: number;
    attendancePct: number | null;
}

export interface AttendanceStatisticsView {
    summary: AttendanceSummary;
    persons: PersonAttendance[];
    /** In schedule order */
    rounds: RoundAttendance[];
}

export interface AttendanceStatistics extends AttendanceStatisticsView {
    /** The same, one role at a time, for roles that have any */
    byRole: Partial<Record<StaffingRole, AttendanceStatisticsView>>;
}

export interface StaffActivity {
    id: string;
    groupId: string;
    person: Person;
    role: string;
    device: Device;
    status: StaffActivityStatus;
    comment?: string;
    isAssigned: boolean;
    /** Left before the group ended; only when present or late */
    leftEarly: boolean;
    /** Not coming for the rest of the day; only when absent */
    noShow: boolean;
    /** Who did the job instead; only when replaced or absent */
    replacedById?: string | null;
    replacedBy?: Pick<Person, "id" | "name"> | null;
    createdAt: Date;
    updatedAt: Date;
}

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
    /** Removed under Regulation 9t: kept, but counts nowhere */
    removedAt?: Date | null;
    removedBy?: PublicUser | null;
    removedReason?: string | null;
    /** The result whose DNF ruling removed this one */
    removedByRulingOf?: { id: string; roundId: string } | null;
}

/** Enter scorecard's view of a result: id is null until the scorecard is saved */
export type ScorecardResult = Pick<
    Result,
    "eventId" | "roundId" | "person" | "attempts"
> & { id: string | null };

export interface ResultToDoubleCheck extends Result {
    combinedName: string;
}

export interface StaffingWarning {
    role: "JUDGE" | "SCRAMBLER";
    groupId: string;
    staffedAttemptId: string;
    staffedResultId: string;
    staffedPersonName: string;
    staffedAttemptNumber: number;
    staffedAttemptType: AttemptType;
}

export interface Attempt {
    id: string;
    resultId: string;
    attemptNumber: number;
    comment?: string;
    replacedBy?: number | null;
    /** What a set-aside grant had, so it can be used again */
    replacedByInGrant?: number | null;
    statusInGrant?: AttemptStatus | null;
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
    fastAttemptRatio?: number;
    staffingWarnings?: StaffingWarning[];
    /** The head-to-head point it was raced on, whose extra covers both */
    h2hPointId?: string | null;
    /** Replaced by an extra on a head-to-head point: no other extra */
    h2hReplaced?: boolean;
}

/** An attempt as the home page lists it, with its competitor */
export interface RecentAttempt extends Attempt {
    result: {
        id: string;
        person: { id: string; name: string };
    };
}

/** An attempt as a device's solve list shows it, with its competitor and round */
export interface DeviceAttempt extends Attempt {
    /** Shown instead of solvedAt for attempts entered without a solve time */
    createdAt: string;
    result: {
        id: string;
        roundId: string;
        person: { id: string; name: string; registrantId?: number };
    };
}

/** Every attempt a device recorded, newest first */
export interface DeviceAttempts {
    device: {
        id: string;
        name: string;
        type: DeviceType;
        retiredAt?: string | null;
        room?: { id: string; name: string } | null;
    };
    attempts: DeviceAttempt[];
}

export interface AttemptToEnterWithScorecard extends Attempt {
    isNew?: boolean;
}

export enum AttemptStatus {
    STANDARD = "STANDARD",
    UNRESOLVED = "UNRESOLVED",
    RESOLVED = "RESOLVED",
    EXTRA_GIVEN = "EXTRA_GIVEN",
    SCRAMBLED = "SCRAMBLED",
    VOIDED = "VOIDED",
}

export enum AttemptType {
    STANDARD_ATTEMPT = "STANDARD_ATTEMPT",
    EXTRA_ATTEMPT = "EXTRA_ATTEMPT",
}

export interface Incident extends Attempt {
    result: Result;
    updateReplacedBy?: boolean;
}

export enum IncidentAction {
    RESOLVED = "RESOLVED",
    EXTRA_GIVEN = "EXTRA_GIVEN",
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

/** Everything incident-related for one person, as competitor or judge */
export interface PersonIncidents {
    attempts: Incident[];
    manual: ManualIncident[];
    noteworthy: NoteworthyIncident[];
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
    firmwareVersion?: string | null;
    count?: number;
    /** Set when the device was deleted while its solves still point to it */
    retiredAt?: string | null;
    /** The round a delegate pointed this station at, instead of its room's (SPEC-007) */
    customRoundId?: string | null;
    customRoundSetAt?: string | null;
    /** While in the future, the station takes tutorial solves (SPEC-012) */
    tutorialEndsAt?: string | null;
    tutorialStartedBy?: { fullName: string } | null;
    /** Stations only, from the backend's memory (SPEC-008) */
    signal?: StationSignal;
    /** Stations only, from the backend's memory (SPEC-010) */
    lastError?: StationLastError | null;
    createdAt: Date;
    updatedAt: Date;
    hwVersion: HardwareVersion;
}

export type SignalLevel = "ok" | "weak" | "unknown";

/** What the router reports about a station, when it runs the instance */
export interface StationLink {
    apSignal: number | null;
    txBitrateKbps: number | null;
    txRetriesPercent: number | null;
}

export interface StationSignal {
    level: SignalLevel;
    /** Median of the last 5 readings, in dBm */
    rssi: number | null;
    link: StationLink | null;
    /** Whether the station has sent its own reading since the backend started */
    reportedRssi: boolean;
}

/** Whether the delegate can fix it, or the rules worked as intended */
export type StationErrorKind = "problem" | "rule";

/** The last error the backend sent a station (SPEC-010) */
export interface StationLastError {
    /** The station text's translation key, e.g. "competitorNotFound" */
    key: string;
    kind: StationErrorKind;
    /** The text the station showed, in its language */
    message: string;
    /** When it last happened, ISO */
    at: string;
    /** How many times in a row it happened */
    count: number;
    cardId: string | null;
    competitorName: string | null;
}

/** The deviceError socket event */
export interface DeviceErrorEvent {
    espId: number;
    lastError: StationLastError | null;
}

/** The deviceSignal socket event */
export interface DeviceSignalEvent extends StationSignal {
    espId: number;
}

export enum DeviceType {
    STATION = "STATION",
    ATTENDANCE_SCRAMBLER = "ATTENDANCE_SCRAMBLER",
    ATTENDANCE_RUNNER = "ATTENDANCE_RUNNER",
}

export enum HardwareVersion {
    V3 = "V3",
    V4 = "V4",
}

export interface DeviceData {
    name: string;
    espId: number;
    signKey?: number;
    type: DeviceType;
    roomId: string;
    hwVersion: HardwareVersion;
}

export interface AvailableDevice {
    espId: number;
    signKey: number;
    type: AvailableDeviceType;
    hw: string;
    /** Set when a device already in the database asks to connect again */
    existingDevice?: { id: string; name: string };
}

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
    end_date: string;
    city: string;
}

export interface Event {
    id: string;
    name: string;
    shortName?: string;
    icon: string;
    useInspection?: boolean;
    maxPenalty?: number;
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
    stageLeadAllRooms?: boolean;
    stageLeadRoomIds?: string[];
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
    /** What to show and scramble, when it differs from the attempt to sign */
    scramble?: { num: number; isExtra: boolean };
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
    replacedBy?: number;
}

export interface AvailableLocale {
    locale: string;
    localeName: string;
}

export interface MissedAssignments {
    person: Person;
    missedAssignments: StaffActivity[];
    missedAssignmentsCount: number;
    lateAssignmentsCount: number;
    lateAssignments: StaffActivity[];
    presentButReplacedAssignments: StaffActivity[];
    presentButReplacedAssignmentsCount: number;
    leftEarlyAssignments: StaffActivity[];
    leftEarlyAssignmentsCount: number;
    noShowAssignments: StaffActivity[];
    noShowAssignmentsCount: number;
    comments: StaffActivity[];
    commentsCount: number;
}

export interface RemainingAndUsedCumulativeLimit {
    used: number;
    remaining: number;
}

export interface AttemptEditLogEntry {
    id: string;
    attemptId: string;
    editedAt: string;
    editedBy?: { id: string; fullName?: string; avatarUrl?: string };
    comment?: string;
    value: number;
    penalty?: number;
    status: AttemptStatus;
    type: AttemptType;
    attemptNumber: number;
    replacedBy?: number;
    judgeId?: string;
    judge?: { id: string; name: string };
    scramblerId?: string;
    scrambler?: { id: string; name: string };
    deviceId?: string;
    device?: { id: string; name: string };
    attemptComment?: string;
}
