import { Competition } from "@wca/helpers";

import { DNF_VALUE } from "./constants";
import {
    Attempt,
    AttemptStatus,
    AttemptType,
    Person,
    Result,
} from "./interfaces";
import regions from "./regions";

export const calculateTotalPages = (count: number, pageSize: number) => {
    return Math.ceil(count / pageSize);
};

export const msToString = (ms: number) => {
    return new Date(ms)
        .toISOString()
        .substr(11, 11)
        .replace(/^[0:]*(?!\.)/g, "");
};

export const getFormattedRealActivityTime = (
    startTime?: Date,
    endTime?: Date
) => {
    if (!startTime && !endTime) return "";
    if (startTime && endTime) {
        return `${formatTime(new Date(startTime).toISOString())} - ${formatTime(
            new Date(endTime).toISOString()
        )}`;
    }
    if (startTime) {
        return `Started at ${formatTime(new Date(startTime).toISOString())}`;
    }
    return `${startTime} - ${endTime}`;
};

export const prettyGender = (gender: string) => {
    switch (gender) {
        case "m":
            return "Male";
        case "f":
            return "Female";
        default:
            return "Other";
    }
};

export const regionNameByIso2 = (iso2: string) => {
    return regions.find((region) => region.iso2 === iso2)?.name;
};

export const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const hours =
        date.getHours() < 10 ? `0${date.getHours()}` : date.getHours();
    const minutes =
        date.getMinutes() < 10 ? `0${date.getMinutes()}` : date.getMinutes();
    return `${hours}:${minutes}`;
};

export const getPersonFromWcif = (registrantId: number, wcif: Competition) => {
    return wcif.persons.find((person) => person.registrantId === registrantId);
};

export const getEventIdFromRoundId = (roundId: string) => {
    return roundId.split("-")[0];
};

export const getRoundInfoFromWcif = (roundId: string, wcif: Competition) => {
    const eventId = getEventIdFromRoundId(roundId);
    const event = wcif.events.find((e) => e.id === eventId);
    return event?.rounds.find((round) => round.id === roundId);
};

export const getCutoffByRoundId = (roundId: string, wcif: Competition) => {
    const round = getRoundInfoFromWcif(roundId, wcif);
    return round?.cutoff || null;
};

export const getLimitByRoundId = (roundId: string, wcif: Competition) => {
    const round = getRoundInfoFromWcif(roundId, wcif);
    return round?.timeLimit || null;
};

export const getNumberOfAttemptsForRound = (
    roundId: string,
    wcif: Competition
): number => {
    const round = getRoundInfoFromWcif(roundId, wcif);
    if (!round) return 0;
    switch (round.format) {
        case "1":
            return 1;
        case "2":
            return 2;
        case "3":
            return 3;
        case "a":
            return 5;
        case "m":
            return 3;
    }
};

export const getCompetitionDates = (startDate: Date, numberOfDays: number) => {
    const dates: Date[] = [];
    for (let i = 0; i < numberOfDays; i++) {
        dates.push(new Date(startDate));
        startDate.setDate(startDate.getDate() + 1);
    }
    return dates;
};

export const isNewcomer = (person: Person) => {
    return (!person.wcaId || person.wcaId === "") && person.canCompete;
};

export const prettyRoundFormat = (format: string, cutoffAttempts?: number) => {
    switch (format) {
        case "1":
            return "Best of 1";
        case "2":
            return "Best of 2";
        case "3":
            return "Best of 3";
        case "a":
            if (!cutoffAttempts) {
                return `Average of 5`;
            }
            return `Best of ${cutoffAttempts} / Average of 5`;
        case "m":
            return "Mean of 3";
        default:
            return "Unknown";
    }
};

export const prettyDeviceType = (type: string) => {
    switch (type) {
        case "STATION":
            return "Station";
        case "ATTENDANCE_SCRAMBLER":
            return "Attendance device for scramblers";
        case "ATTENDANCE_RUNNER":
            return "Attendance device for runners";
        default:
            return "Unknown";
    }
};

export const prettyAvailableDeviceType = (type: string) => {
    switch (type) {
        case "STATION":
            return "Station";
        case "STAFF_ATTENDANCE":
            return "Staff attendance device";
        default:
            return "Unknown";
    }
};

export const prettyAccountRoleName = (role: string) => {
    switch (role) {
        case "ADMIN":
            return "Admin";
        case "STAFF":
            return "Staff";
        default:
            return "Unknown";
    }
};

interface AttemptWithNumber extends Attempt {
    number: number;
}

//eslint-disable-next-line
//@ts-ignore
export const getExtra = (originalAttemptId: string, attempts: Attempt[]) => {
    const originalAttempt = attempts.find((a) => a.id === originalAttemptId);
    const extraAttempt = attempts.find(
        (a) =>
            a.attemptNumber === originalAttempt?.replacedBy &&
            a.type === AttemptType.EXTRA_ATTEMPT
    );
    if (extraAttempt && extraAttempt.replacedBy) {
        //eslint-disable-next-line
        //@ts-ignore
        const furtherExtraAttempt = getExtra(extraAttempt.id, attempts);
        return furtherExtraAttempt || extraAttempt;
    }
    return extraAttempt;
};

export const getSubmittedAttempts = (attempts: Attempt[]) => {
    const attemptsToReturn: AttemptWithNumber[] = [];
    attempts
        .sort((a, b) => a.attemptNumber - b.attemptNumber)
        .forEach((attempt) => {
            if (
                attempt.replacedBy === null &&
                attempt.type === AttemptType.STANDARD_ATTEMPT &&
                (attempt.status === AttemptStatus.STANDARD ||
                    attempt.status === AttemptStatus.RESOLVED) &&
                !attemptsToReturn.some((a) => a.id === attempt.id)
            ) {
                attemptsToReturn.push({
                    ...attempt,
                    number: attemptsToReturn.length + 1,
                });
            } else if (
                attempt.replacedBy !== null &&
                attempt.status === AttemptStatus.EXTRA_GIVEN
            ) {
                const extraAttempt = getExtra(attempt.id, attempts);
                if (
                    extraAttempt &&
                    !attemptsToReturn.some((a) => a.id === extraAttempt.id)
                ) {
                    attemptsToReturn.push({
                        ...extraAttempt,
                        number: attempt.attemptNumber,
                    });
                }
            }
        });
    return attemptsToReturn
        .sort((a, b) => a.number - b.number)
        .map((a) => a as Attempt);
};

export const isThereADifferenceBetweenResults = (
    result: Result,
    submittedAttempts: Attempt[],
    wcif: Competition
) => {
    const resultsFromWcaLive = wcif.events
        .find((event) => event.id === result?.eventId)
        ?.rounds.find((round) => round.id === result?.roundId)
        ?.results.find(
            (wcifResult) => wcifResult.personId === result.person.registrantId
        );
    if (!resultsFromWcaLive) return false;
    if (submittedAttempts.length !== resultsFromWcaLive.attempts.length)
        return true;
    for (let i = 0; i < submittedAttempts.length; i++) {
        const submittedValue =
            submittedAttempts[i].penalty === DNF_VALUE
                ? DNF_VALUE
                : submittedAttempts[i].value +
                  submittedAttempts[i].penalty * 100;
        if (submittedValue !== resultsFromWcaLive.attempts[i].result)
            return true;
    }
    return false;
};

export const isMobile = () => {
    const regex =
        /Mobi|Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
    return regex.test(navigator.userAgent);
};

export const isMobileView = () => {
    return window.innerWidth < 768;
};

export const isNotificationsSupported = () => {
    return "Notification" in window;
};

export const prettyAttemptStatus = (
    status: AttemptStatus,
    isIncidentPage?: boolean
) => {
    switch (status) {
        case AttemptStatus.STANDARD:
            return "Standard";
        case AttemptStatus.UNRESOLVED:
            return "Unresolved delegate case";
        case AttemptStatus.RESOLVED:
            return isIncidentPage
                ? "Resolved without extra"
                : "Resolved delegate case, leave as is";
        case AttemptStatus.EXTRA_GIVEN:
            return "Extra given";
    }
};

export const prettyAttemptType = (type: AttemptType) => {
    switch (type) {
        case AttemptType.STANDARD_ATTEMPT:
            return "Standard attempt";
        case AttemptType.EXTRA_ATTEMPT:
            return "Extra attempt";
    }
};

export const getResolvedStatus = (status: AttemptStatus) => {
    switch (status) {
        case AttemptStatus.RESOLVED:
            return "Resolved";
        case AttemptStatus.UNRESOLVED:
            return "Not resolved";
        case AttemptStatus.EXTRA_GIVEN:
            return "Extra given";
        default:
            return "Unknown";
    }
};
