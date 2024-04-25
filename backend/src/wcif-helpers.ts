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
