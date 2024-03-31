import { Activity, Competition } from "@wca/helpers";

import { DNF_VALUE } from "./constants";
import { Attempt, AttemptStatus, Attendance, Result } from "./interfaces";
import regions from "./regions";

export const calculateTotalPages = (count: number, pageSize: number) => {
    return Math.ceil(count / pageSize);
};

export const msToString = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(2);
    if (minutes > 0) return `${minutes}:${+seconds < 10 ? "0" : ""}${seconds}`;
    return `${+seconds}s`;
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
        case "DELEGATE":
            return "Delegate";
        case "ADMIN":
            return "Admin";
        case "STAFF":
            return "Staff";
        default:
            return "Unknown";
    }
};

export const getAbsentPeople = (
    wcif: Competition,
    presentPeople: Attendance[],
    groupId: string,
    role: string
) => {
    const activities: Activity[] = [];
    wcif.schedule?.venues[0].rooms.forEach((room) => {
        room.activities.forEach((a) => {
            a.childActivities.forEach((ca) => {
                if (ca.activityCode === groupId) {
                    activities.push(ca);
                }
            });
        });
    });
    if (activities.length === 0) return [];
    const wcifRole = attendanceRoleToWcif(role);
    return wcif.persons.filter((person) => {
        if (
            person.assignments?.some(
                (assignment) =>
                    activities.some((a) => a.id === assignment.activityId) &&
                    assignment.assignmentCode === wcifRole
            ) &&
            !presentPeople.some(
                (p) => p.person.registrantId === person.registrantId
            )
        ) {
            return person;
        }
    });
};

export const attendanceRoleToWcif = (role: string) => {
    switch (role) {
        case "SCRAMBLER":
            return "staff-scrambler";
        case "RUNNER":
            return "staff-runner";
        case "JUDGE":
            return "staff-judge";
    }
};

interface AttemptWithNumber extends Attempt {
    number: number;
}

export const getSubmittedAttempts = (attempts: Attempt[]) => {
    const attemptsToReturn: AttemptWithNumber[] = [];
    attempts
        .sort((a, b) => a.attemptNumber - b.attemptNumber)
        .forEach((attempt) => {
            if (
                attempt.replacedBy === null &&
                attempt.status !== AttemptStatus.EXTRA_GIVEN &&
                attempt.status !== AttemptStatus.EXTRA_ATTEMPT &&
                attempt.status !== AttemptStatus.UNRESOLVED &&
                !attemptsToReturn.some((a) => a.id === attempt.id)
            )
                attemptsToReturn.push({
                    ...attempt,
                    number: attemptsToReturn.length + 1,
                });
            if (
                attempt.replacedBy !== null &&
                attempt.status === "EXTRA_GIVEN"
            ) {
                const extraAttempt = attempts.find(
                    (a) =>
                        a.attemptNumber === attempt.replacedBy &&
                        a.status === AttemptStatus.EXTRA_ATTEMPT
                );
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

export const getRoundNameById = (roundId: string, wcif?: Competition) => {
    if (!wcif) return "";
    let roundName = "";
    wcif.schedule?.venues.forEach((venue) => {
        venue.rooms.forEach((room) => {
            room.activities.forEach((activity) => {
                if (activity.activityCode === roundId) {
                    roundName = activity.name;
                }
            });
        });
    });
    return roundName;
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

export const getActivityNameByCode = (code: string, wcif: Competition) => {
    let activityName = "";
    wcif.schedule.venues.forEach((venue) => {
        venue.rooms.forEach((room) => {
            room.activities.forEach((activity) => {
                if (activity.activityCode === code) {
                    activityName = activity.name;
                }
                activity.childActivities.forEach((childActivity) => {
                    if (childActivity.activityCode === code) {
                        activityName = childActivity.name;
                    }
                });
            });
        });
    });
    return activityName;
};

export const isMobile = () => {
    const regex =
        /Mobi|Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
    return regex.test(navigator.userAgent);
};

export const isNotificationsSupported = () => {
    return "Notification" in window;
};

export const prettyAttemptStatus = (status: AttemptStatus) => {
    switch (status) {
        case AttemptStatus.STANDARD_ATTEMPT:
            return "Standard attempt";
        case AttemptStatus.EXTRA_ATTEMPT:
            return "Extra attempt";
        case AttemptStatus.UNRESOLVED:
            return "Unresolved delegate case";
        case AttemptStatus.RESOLVED:
            return "Resolved delegate case, leave as is";
        case AttemptStatus.EXTRA_GIVEN:
            return "Extra given";
    }
};

export const getResolvedStatus = (status: AttemptStatus) => {
    if (status === AttemptStatus.RESOLVED) return "Resolved";
    else if (status === AttemptStatus.UNRESOLVED) return "Not resolved";
    else if (status === AttemptStatus.EXTRA_GIVEN) return "Extra given";
    return null;
};
