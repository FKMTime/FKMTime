import { Activity, Competition } from '@wca/helpers';

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Milliseconds since epoch of a "YYYY-MM-DD" date at UTC midnight */
const parseDate = (date: string) => {
  const time = DATE_PATTERN.test(date) ? Date.parse(`${date}T00:00:00Z`) : NaN;
  if (
    Number.isNaN(time) ||
    new Date(time).toISOString().slice(0, 10) !== date
  ) {
    throw new Error(`Expected a date like 2024-05-24, got "${date}"`);
  }
  return time;
};

/** The calendar date on this machine, as "YYYY-MM-DD" */
export const localDate = (now = new Date()) =>
  [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');

/** How far the timezone's wall clock is ahead of UTC at a moment, in ms */
const timezoneOffset = (time: number, timezone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(time));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type).value);
  const wallClock = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  );
  return wallClock - (time - (time % 1000));
};

/**
 * Move a moment by whole days on the timezone's wall clock, so 09:00 local
 * stays 09:00 local even when a DST change falls between the two dates
 */
const shiftByDays = (iso: string, days: number, timezone: string) => {
  const time = Date.parse(iso);
  const wallClock = time + timezoneOffset(time, timezone) + days * DAY_MS;
  // The offset at the new date may differ; one correction settles it
  let shifted = wallClock - timezoneOffset(wallClock, timezone);
  shifted = wallClock - timezoneOffset(shifted, timezone);
  return new Date(shifted).toISOString().replace('.000Z', 'Z');
};

/**
 * A copy of the WCIF moved so the competition starts on `startDate`
 * ("YYYY-MM-DD"): the schedule start, every activity and child activity, and
 * the registration window all move by the same number of days. Times of day
 * stay the same in each venue's timezone.
 */
export const shiftWcifDates = (
  wcif: Competition,
  startDate: string,
): Competition => {
  const days = Math.round(
    (parseDate(startDate) - parseDate(wcif.schedule.startDate)) / DAY_MS,
  );
  const shifted: Competition = structuredClone(wcif);
  if (days === 0) return shifted;

  const shiftActivity = (activity: Activity, timezone: string) => {
    activity.startTime = shiftByDays(activity.startTime, days, timezone);
    activity.endTime = shiftByDays(activity.endTime, days, timezone);
    activity.childActivities?.forEach((child) =>
      shiftActivity(child, timezone),
    );
  };

  shifted.schedule.startDate = startDate;
  shifted.schedule.venues.forEach((venue) =>
    venue.rooms.forEach((room) =>
      room.activities.forEach((activity) =>
        shiftActivity(activity, venue.timezone),
      ),
    ),
  );

  const registration = shifted.registrationInfo;
  const registrationTimezone = shifted.schedule.venues[0]?.timezone ?? 'UTC';
  if (registration?.openTime) {
    registration.openTime = shiftByDays(
      registration.openTime,
      days,
      registrationTimezone,
    );
  }
  if (registration?.closeTime) {
    registration.closeTime = shiftByDays(
      registration.closeTime,
      days,
      registrationTimezone,
    );
  }
  return shifted;
};
