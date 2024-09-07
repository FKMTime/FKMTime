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
