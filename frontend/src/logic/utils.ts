import { activityCodeToName, Competition } from "@wca/helpers";

import { DNF_VALUE } from "./constants";
import { getEventShortName, isUnofficialEvent } from "./events";
import {
    Attempt,
    AttemptStatus,
    AttemptType,
    Person,
    Result,
    User,
} from "./interfaces";
import regions from "./regions";

export const calculateTotalPages = (count: number, pageSize: number) => {
    return Math.ceil(count / pageSize);
};

export const shortRoundName = (roundId: string) => {
    const [eventId, roundNumber] = roundId.split("-r");
    return `${getEventShortName(eventId)} R${roundNumber}`;
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

export const isNewcomer = (person: Person) => {
    return (!person.wcaId || person.wcaId === "") && person.canCompete;
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
export const prettyUserRoleNameIncludingWCA = (user: User) => {
    if (user.isWcaAdmin) return "WCA Admin";
    return prettyUserRoleName(user.role);
};

export const prettyUserRoleName = (role: string) => {
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
            return "";
    }
};

export const cumulativeRoundsToString = (roundIds: string[]) => {
    return roundIds
        .map((roundId) => {
            return activityCodeToName(roundId);
        })
        .join(", ");
};

export const prettySendingResultsFrequency = (frequency: string) => {
    switch (frequency) {
        case "NEVER":
            return "Do not send";
        case "AFTER_SOLVE":
            return "Send after every solve";
        case "EVERY_5_MINUTES":
            return "Send active rounds results every 5 minutes";
        default:
            return "Unknown";
    }
};

export const getSubmissionPlatformName = (eventId: string) => {
    return isUnofficialEvent(eventId) ? "Cubing Contests" : "WCA Live";
};
