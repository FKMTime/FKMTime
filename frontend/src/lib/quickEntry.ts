import { Competition as WCIF, getRoundInfoFromWcif } from "wcif-helpers";

import { roundFormats } from "./constants";
import { Attempt, AttemptStatus, AttemptType, Person } from "./interfaces";
import {
    autocompleteTimeAttemptResult,
    inputToAttemptResult,
    isValid,
} from "./resultFormatters";

export interface AttemptOption {
    /** "1"…"5", "E1", "E2" */
    value: string;
    attemptNumber: number;
    type: AttemptType;
    title: string;
}

/** What a scramble set usually has; a redo can need more */
const EXTRA_ATTEMPTS = 2;
const DEFAULT_ATTEMPTS = 5;

export const getNumberOfAttempts = (roundId: string, wcif?: WCIF) => {
    const format = wcif
        ? getRoundInfoFromWcif(roundId, wcif)?.format
        : undefined;
    return (
        roundFormats.find((f) => f.format === format)?.numberOfAttempts ??
        DEFAULT_ATTEMPTS
    );
};

type ExistingAttempt = Pick<Attempt, "attemptNumber" | "type"> &
    Partial<Pick<Attempt, "status" | "replacedBy">>;

const isWaitingForExtra = (attempt: ExistingAttempt) =>
    attempt.status === AttemptStatus.EXTRA_GIVEN && !attempt.replacedBy;

/** Enough extras for the ones that exist and for every attempt waiting */
const getExtrasCount = (existing: ExistingAttempt[]) => {
    const extras = existing.filter(
        (attempt) => attempt.type === AttemptType.EXTRA_ATTEMPT
    );
    return Math.max(
        EXTRA_ATTEMPTS,
        extras.length + existing.filter(isWaitingForExtra).length,
        ...extras.map((attempt) => attempt.attemptNumber)
    );
};

/** Standard attempts for the round's format, then the extras */
export const getAttemptOptions = (
    numberOfAttempts: number,
    existing: ExistingAttempt[] = []
): AttemptOption[] => [
    ...Array.from({ length: numberOfAttempts }, (_, i) => ({
        value: String(i + 1),
        attemptNumber: i + 1,
        type: AttemptType.STANDARD_ATTEMPT,
        title: `Attempt ${i + 1}`,
    })),
    ...Array.from({ length: getExtrasCount(existing) }, (_, i) => ({
        value: `E${i + 1}`,
        attemptNumber: i + 1,
        type: AttemptType.EXTRA_ATTEMPT,
        title: `Extra attempt ${i + 1}`,
    })),
];

/**
 * The first standard attempt the competitor doesn't have yet, otherwise the
 * first unused extra, otherwise attempt 1. An attempt waiting for a redo comes
 * first, as it does at a station.
 */
export const getNextAttemptValue = (
    options: AttemptOption[],
    existing: ExistingAttempt[]
) => {
    const taken = new Set(
        existing.map((attempt) => `${attempt.type}:${attempt.attemptNumber}`)
    );
    const next = options.find(
        (option) =>
            !taken.has(`${option.type}:${option.attemptNumber}`) &&
            (option.type === AttemptType.EXTRA_ATTEMPT ||
                !existing.some(isWaitingForExtra))
    );
    return (next ?? options[0])?.value ?? "1";
};

/**
 * Competitors registered for the event who can compete, matching the query
 * by name or exact registrant ID.
 */
export const matchCompetitors = (
    persons: Person[],
    wcif: WCIF,
    eventId: string,
    query: string,
    limit = 5
): Person[] => {
    const search = query.trim().toLowerCase();
    if (!search) return [];
    const registered = new Set(
        wcif.persons
            .filter((p) => p.registration?.eventIds.includes(eventId))
            .map((p) => p.registrantId)
    );
    return persons
        .filter(
            (person) =>
                person.canCompete &&
                person.registrantId !== undefined &&
                registered.has(person.registrantId) &&
                (person.name.toLowerCase().includes(search) ||
                    String(person.registrantId) === search)
        )
        .slice(0, limit);
};

export const isRegisteredFor = (person: Person, wcif: WCIF, eventId: string) =>
    wcif.persons.some(
        (p) =>
            p.registrantId === person.registrantId &&
            !!p.registration?.eventIds.includes(eventId)
    );

/** Centiseconds for a typed time ("984", "9.84", "1:02.31"), or null */
export const parseQuickTime = (input: string): number | null => {
    if (!input || !isValid(input)) return null;
    const value = autocompleteTimeAttemptResult(inputToAttemptResult(input));
    return value > 0 ? value : null;
};

/** Rounds in progress, each with the rooms and groups running it */
export const getQuickEntryRounds = (
    rooms: { name: string; currentGroupIds: string[] }[]
): { roundId: string; meta: string }[] => {
    const metas = new Map<string, string[]>();
    for (const room of rooms) {
        for (const groupId of room.currentGroupIds) {
            const [roundId, group] = groupId.split("-g");
            metas.set(roundId, [
                ...(metas.get(roundId) ?? []),
                `${room.name} · Group ${group}`,
            ]);
        }
    }
    return [...metas].map(([roundId, list]) => ({
        roundId,
        meta: list.join(", "),
    }));
};
