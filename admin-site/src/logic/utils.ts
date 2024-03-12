import {Competition} from "@wca/helpers";
import regions from "./regions";
import {Attempt, Attendance, Result} from "./interfaces";

export const calculateTotalPages = (count: number, pageSize: number) => {
    return Math.ceil(count / pageSize);
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
    const event = wcif.events.find((event) => event.id === eventId);
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

export const getPrettyCompetitionEndDate = (
    startDate: string,
    numberOfDays: number
) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + numberOfDays - 1);
    return date.toLocaleDateString();
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

export const getAbsentPeople = (wcif: Competition, presentPeople: Attendance[], roomName: string, groupId: string, role: string) => {
    const activity = wcif.schedule?.venues[0].rooms.find((room) => room.name === roomName)?.activities.find((activity) => activity.activityCode === groupId.split("-g")[0])?.childActivities.find((activity) => activity.activityCode === groupId);
    if (!activity) return [];
    const wcifRole = attendanceRoleToWcif(role);
    return wcif.persons.filter((person) => {
        if (person.assignments?.some((assignment) => assignment.activityId === activity.id && assignment.assignmentCode === wcifRole) && !presentPeople.some((p) => p.person.registrantId === person.registrantId)) {
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
}
interface AttemptWithNumber extends Attempt {
    number: number;
}

export const getSubmittedAttempts = (attempts: Attempt[]) => {
    const attemptsToReturn: AttemptWithNumber[] = [];
    attempts.forEach((attempt) => {
        if (
            attempt.replacedBy === null &&
            !attempt.extraGiven &&
            !attemptsToReturn.some((a) => a.id === attempt.id) &&
            !attempt.isExtraAttempt
        )
            attemptsToReturn.push({
                ...attempt,
                number: attemptsToReturn.length + 1,
            });
        if (attempt.replacedBy !== null && attempt.extraGiven) {
            const extraAttempt = attempts.find(
                (a) =>
                    a.attemptNumber === attempt.replacedBy &&
                    a.isExtraAttempt
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
            submittedAttempts[i].penalty === -1
                ? -1
                : submittedAttempts[i].value +
                  submittedAttempts[i].penalty * 100;
        if (submittedValue !== resultsFromWcaLive.attempts[i].result)
            return true;
    }
    return false;
};
