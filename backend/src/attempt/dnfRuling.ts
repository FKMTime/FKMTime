import { AttemptEditLog, AttemptStatus } from '@prisma/client';
import { DNF_VALUE } from 'src/constants';

export const RULED_DNF = 'Ruled DNF';
/** A remaining attempt recorded as DNF after a disqualification */
export const REMAINING_RULED_DNF = 'Remaining attempt ruled DNF';
export const DNF_RULING_UNDONE = 'DNF ruling undone';

type LogEntry = Pick<AttemptEditLog, 'comment' | 'penalty' | 'editedAt'> &
  Partial<Pick<AttemptEditLog, 'status'>>;

export interface RuledAttempt {
  /** Recorded by the ruling itself, so restoring removes it */
  addedByRuling: boolean;
  penalty?: number | null;
  status?: AttemptStatus;
}

const lastIndexWhere = <T>(items: T[], matches: (item: T) => boolean) => {
  for (let i = items.length - 1; i >= 0; i--) {
    if (matches(items[i])) return i;
  }
  return -1;
};

const isRuling = (log: LogEntry) =>
  log.comment === RULED_DNF || log.comment === REMAINING_RULED_DNF;

/**
 * How an attempt was before a DNF ruling that still stands, read from its edit
 * history. Undefined when no ruling stands or the history can't tell.
 */
export const getStateBeforeRuling = (
  penalty: number | null,
  logs: LogEntry[],
): RuledAttempt | undefined => {
  if (penalty !== DNF_VALUE) return undefined;
  const sorted = [...logs].sort(
    (a, b) => a.editedAt.getTime() - b.editedAt.getTime(),
  );
  const ruling = lastIndexWhere(sorted, isRuling);
  if (ruling < 0) return undefined;
  // Undone, or the penalty was set by hand since
  const superseded = sorted
    .slice(ruling + 1)
    .some(
      (log) => log.comment === DNF_RULING_UNDONE || log.penalty !== DNF_VALUE,
    );
  if (superseded) return undefined;
  if (sorted[ruling].comment === REMAINING_RULED_DNF) {
    return { addedByRuling: true };
  }
  const before = lastIndexWhere(
    sorted.slice(0, ruling),
    (log) => log.penalty !== DNF_VALUE,
  );
  return before < 0
    ? undefined
    : {
        addedByRuling: false,
        penalty: sorted[before].penalty,
        status: sorted[before].status,
      };
};
