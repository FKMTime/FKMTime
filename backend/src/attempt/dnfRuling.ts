import { AttemptEditLog } from '@prisma/client';
import { DNF_VALUE } from 'src/constants';

export const RULED_DNF = 'Ruled DNF';
export const DNF_RULING_UNDONE = 'DNF ruling undone';

type LogEntry = Pick<AttemptEditLog, 'comment' | 'penalty' | 'editedAt'>;

const lastIndexWhere = <T>(items: T[], matches: (item: T) => boolean) => {
  for (let i = items.length - 1; i >= 0; i--) {
    if (matches(items[i])) return i;
  }
  return -1;
};

/**
 * The penalty an attempt had before a DNF ruling that still stands, read from
 * its edit history. Undefined when no ruling stands or the history can't tell.
 */
export const getPenaltyBeforeRuling = (
  penalty: number | null,
  logs: LogEntry[],
): { penalty: number | null } | undefined => {
  if (penalty !== DNF_VALUE) return undefined;
  const sorted = [...logs].sort(
    (a, b) => a.editedAt.getTime() - b.editedAt.getTime(),
  );
  const ruling = lastIndexWhere(sorted, (log) => log.comment === RULED_DNF);
  if (ruling < 0) return undefined;
  // Undone, or the penalty was set by hand since
  const superseded = sorted
    .slice(ruling + 1)
    .some(
      (log) => log.comment === DNF_RULING_UNDONE || log.penalty !== DNF_VALUE,
    );
  if (superseded) return undefined;
  const before = lastIndexWhere(
    sorted.slice(0, ruling),
    (log) => log.penalty !== DNF_VALUE,
  );
  return before < 0 ? undefined : { penalty: sorted[before].penalty };
};
