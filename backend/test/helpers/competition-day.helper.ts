import { INestApplication } from '@nestjs/common';
import { Person, Role } from '@prisma/client';
import { AuthService } from 'src/auth/auth.service';
import { DbService } from 'src/db/db.service';

/**
 * Helpers for the competition-day e2e specs (persons, attendance, attempts,
 * results, incidents and the cross-module round flows).
 */

export type RoleName =
  'STAFF' | 'STAGE_LEADER' | 'ORGANIZER' | 'DELEGATE' | 'NO_ROLE';

export interface RoleUsers {
  tokens: Record<RoleName, string>;
  userIds: Record<RoleName, string>;
  cleanup: () => Promise<void>;
}

const ROLE_MAP: Record<RoleName, Role[]> = {
  STAFF: [Role.STAFF],
  STAGE_LEADER: [Role.STAGE_LEADER],
  ORGANIZER: [Role.ORGANIZER],
  DELEGATE: [Role.DELEGATE],
  NO_ROLE: [],
};

/**
 * Creates one user per role (usernames prefixed with `prefix`) and signs a
 * JWT for each. The seed only has an ADMIN user, so the guard checks need
 * these. `cleanup` removes everything the users created first.
 */
export const createRoleUsers = async (
  app: INestApplication,
  db: DbService,
  prefix: string,
): Promise<RoleUsers> => {
  const authService = app.get(AuthService);
  const tokens = {} as Record<RoleName, string>;
  const userIds = {} as Record<RoleName, string>;

  await db.user.deleteMany({ where: { username: { startsWith: prefix } } });

  for (const [name, roles] of Object.entries(ROLE_MAP) as [
    RoleName,
    Role[],
  ][]) {
    const user = await db.user.create({
      data: {
        username: `${prefix}-${name.toLowerCase()}`,
        fullName: `E2E ${name}`,
        roles,
      },
    });
    userIds[name] = user.id;
    tokens[name] = await authService.generateAuthJwt({
      userId: user.id,
      roles,
    });
  }

  const cleanup = async () => {
    const ids = Object.values(userIds);
    await db.noteworthyIncident.deleteMany({
      where: { createdById: { in: ids } },
    });
    await db.warning.deleteMany({ where: { createdById: { in: ids } } });
    await db.manualIncident.deleteMany({ where: { createdById: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
  };

  return { tokens, userIds, cleanup };
};

/**
 * Creates competitors with invented names and registrant ids that do not
 * collide with the seed WCIF (which uses 1-25).
 */
export const createTestPersons = async (
  db: DbService,
  prefix: string,
  registrantIds: number[],
  extra: Partial<Person> = {},
): Promise<Person[]> => {
  await deleteTestPersons(db, { registrantIds });
  const persons: Person[] = [];
  for (const registrantId of registrantIds) {
    persons.push(
      await db.person.create({
        data: {
          name: `${prefix} Competitor ${registrantId}`,
          registrantId,
          gender: 'o',
          countryIso2: 'XA',
          canCompete: true,
          ...extra,
        },
      }),
    );
  }
  return persons;
};

/** Removes test persons together with everything that references them */
export const deleteTestPersons = async (
  db: DbService,
  where: { registrantIds?: number[]; ids?: string[] },
) => {
  const persons = await db.person.findMany({
    where: {
      OR: [
        ...(where.registrantIds
          ? [{ registrantId: { in: where.registrantIds } }]
          : []),
        ...(where.ids ? [{ id: { in: where.ids } }] : []),
      ],
    },
    select: { id: true },
  });
  const ids = persons.map((p) => p.id);
  if (ids.length === 0) return;
  await db.noteworthyIncident.deleteMany({
    where: { attempt: { result: { personId: { in: ids } } } },
  });
  await db.warning.deleteMany({ where: { personId: { in: ids } } });
  await db.attempt.updateMany({
    where: { judgeId: { in: ids } },
    data: { judgeId: null },
  });
  await db.attempt.updateMany({
    where: { scramblerId: { in: ids } },
    data: { scramblerId: null },
  });
  await db.person.deleteMany({ where: { id: { in: ids } } });
};

export interface WcaLiveSubmission {
  competitionWcaId: string;
  eventId: string;
  roundNumber: number;
  results: {
    registrantId: number;
    wcaId: string | null;
    attempts: { result: number }[];
  }[];
}

interface ExternalHandler {
  match: (url: string, init?: RequestInit) => boolean;
  respond: (
    url: string,
    init?: RequestInit,
  ) => { status: number; body: unknown };
}

/**
 * Replaces the WCA Live API (and optionally other external calls) with an
 * in-memory stub so specs can assert exactly what FKMTime submits, without
 * depending on a dummy WCA Live container (CI does not run one).
 */
export const stubExternalApis = (handlers: ExternalHandler[] = []) => {
  const originalFetch = global.fetch;
  const submissions: WcaLiveSubmission[] = [];
  const calls: { url: string; method: string; body: any }[] = [];
  let wcaLiveStatus = 200;

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  const spy = jest
    .spyOn(global, 'fetch')
    .mockImplementation(async (input: any, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const body =
        typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      calls.push({ url, method: init?.method ?? 'GET', body });
      if (url.endsWith('/enter-results')) {
        submissions.push(body);
        return json(wcaLiveStatus, { ok: wcaLiveStatus === 200 });
      }
      const handler = handlers.find((h) => h.match(url, init));
      if (handler) {
        const { status, body: responseBody } = handler.respond(url, init);
        return json(status, responseBody);
      }
      return originalFetch(input, init);
    });

  return {
    submissions,
    calls,
    setWcaLiveStatus: (status: number) => {
      wcaLiveStatus = status;
    },
    reset: () => {
      submissions.length = 0;
      calls.length = 0;
      wcaLiveStatus = 200;
    },
    /** Attempts most recently submitted to WCA Live for a registrant */
    lastAttemptsFor: (registrantId: number, roundId?: string) => {
      for (let i = submissions.length - 1; i >= 0; i--) {
        const s = submissions[i];
        if (roundId && `${s.eventId}-r${s.roundNumber}` !== roundId) continue;
        const r = s.results.find((res) => res.registrantId === registrantId);
        if (r) return r.attempts.map((a) => a.result);
      }
      return undefined;
    },
    restore: () => spy.mockRestore(),
  };
};
