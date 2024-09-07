import { Activity, Competition } from '@wca/helpers';

export const getGroupInfoByActivityId = (
  activityId: number,
  wcif: Competition,
) => {
  let groupInfo: Activity | null = null;
  wcif.schedule.venues.forEach((venue) => {
    venue.rooms.forEach((room) => {
      room.activities.forEach((activity) => {
        if (activity.id === activityId) {
          groupInfo = activity;
        }
        activity.childActivities.forEach((childActivity) => {
          if (childActivity.id === activityId) {
            groupInfo = childActivity;
          }
        });
      });
    });
  });
  return groupInfo as Activity | null;
};

export const wcifRoleToAttendanceRole = (role: string) => {
  switch (role) {
    case 'staff-judge':
      return 'JUDGE';
    case 'staff-runner':
      return 'RUNNER';
    case 'staff-scrambler':
      return 'SCRAMBLER';
    default:
      return 'COMPETITOR';
  }
};

export const getRoundInfoFromWcif = (roundId: string, wcif: Competition) => {
  const eventId = getEventIdFromRoundId(roundId);
  const event = wcif.events.find((e) => e.id === eventId);
  return event?.rounds.find((round) => round.id === roundId);
};

export const getEventIdFromRoundId = (roundId: string) => {
  return roundId.split('-')[0];
};

export const getNumberOfAttemptsForRound = (
  roundId: string,
  wcif: Competition,
): number => {
  const round = getRoundInfoFromWcif(roundId, wcif);
  if (!round) return 0;
  switch (round.format) {
    case '1':
      return 1;
    case '2':
      return 2;
    case '3':
      return 3;
    case 'a':
      return 5;
    case 'm':
      return 3;
  }
};

export const getActivityInfoFromSchedule = (
  roundId: string,
  wcif: Competition,
) => {
  let activityToReturn: Activity | null = null;
  wcif.schedule.venues.forEach((venue) => {
    venue.rooms.forEach((room) => {
      room.activities.forEach((activity) => {
        if (activity.activityCode === roundId) {
          activityToReturn = activity;
        }
        activity.childActivities.forEach((childActivity) => {
          if (childActivity.activityCode === roundId) {
            activityToReturn = childActivity;
          }
        });
      });
    });
  });
  return activityToReturn;
};
