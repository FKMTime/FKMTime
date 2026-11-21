import { HttpException } from '@nestjs/common';
import { AppGateway } from 'src/app.gateway';
import { DbService } from 'src/db/db.service';

import { DelegateGrant, Role } from '../generated/prisma/client';
import { DelegateGrantService } from './delegateGrant.service';

const GROUP = '333-r1-g2';
const GROUP_STARTED_AT = new Date('2026-01-01T10:00:00Z');
const ROUND = '333-r1';

interface State {
  grants: DelegateGrant[];
  rooms: { id: string; currentGroupIds: string[] }[];
  /** personIds assigned to GROUP */
  assigned: string[];
  /** personIds with an attempt in the room since the grant started */
  solvedInRoom: string[];
  /** resultId -> person and round */
  results: Record<string, { personId: string; roundId: string }>;
}

const grant = (fields: Partial<DelegateGrant>): DelegateGrant => ({
  id: 'grant-1',
  userId: 'helper',
  groupId: GROUP,
  permissions: ['GIVE_EXTRA', 'ADD_ATTEMPT', 'REORDER_ATTEMPTS'],
  createdById: 'delegate',
  createdAt: new Date(0),
  activatedAt: null,
  endedAt: null,
  endedById: null,
  ...fields,
});

/** Just enough of Prisma for the queries the access checks make */
const fakeDb = (state: State) => {
  const matches = (g: DelegateGrant, where: any = {}) =>
    (where.userId === undefined || g.userId === where.userId) &&
    (where.endedAt === undefined ||
      (where.endedAt === null ? g.endedAt === null : g.endedAt !== null)) &&
    (where.activatedAt === undefined || g.activatedAt !== null);
  return {
    delegateGrant: {
      findMany: jest.fn(async ({ where }) =>
        state.grants.filter((g) => matches(g, where)),
      ),
      findFirst: jest.fn(
        async ({ where }) =>
          state.grants.find((g) => matches(g, where)) ?? null,
      ),
      count: jest.fn(
        async ({ where }) =>
          state.grants.filter((g) => matches(g, where)).length,
      ),
      update: jest.fn(async ({ where, data }) => {
        const found = state.grants.find((g) => g.id === where.id);
        Object.assign(found, data);
        return found;
      }),
    },
    room: { findMany: jest.fn(async () => state.rooms) },
    staffActivity: {
      findMany: jest.fn(async () =>
        state.assigned.map((personId) => ({ personId })),
      ),
    },
    result: {
      findMany: jest.fn(async () =>
        state.solvedInRoom.map((personId) => ({ personId })),
      ),
      findFirst: jest.fn(async ({ where }) => {
        const result = state.results[where.id];
        return result
          ? { id: where.id, ...result, person: { name: 'Competitor' } }
          : null;
      }),
    },
  };
};

const setup = (overrides: Partial<State> = {}) => {
  const state: State = {
    grants: [grant({})],
    rooms: [{ id: 'room-1', currentGroupIds: [GROUP] }],
    assigned: ['assigned'],
    solvedInRoom: ['walk-in'],
    results: {
      'r-assigned': { personId: 'assigned', roundId: ROUND },
      'r-walk-in': { personId: 'walk-in', roundId: ROUND },
      'r-other': { personId: 'other', roundId: ROUND },
      'r-next-round': { personId: 'assigned', roundId: '333-r2' },
    },
    ...overrides,
  };
  const gateway = {
    handleDelegateGrantChanged: jest.fn(),
    handleDelegateGrantAction: jest.fn(),
  };
  const service = new DelegateGrantService(
    fakeDb(state) as unknown as DbService,
    gateway as unknown as AppGateway,
  );
  // The room started the group at GROUP_STARTED_AT
  service.useGroupEnteredAt(() => GROUP_STARTED_AT.getTime());
  return { service, state, gateway };
};

const helper = { userId: 'helper', roles: [Role.STAFF] };

const refusal = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (e) {
    expect(e).toBeInstanceOf(HttpException);
    return {
      status: (e as HttpException).getStatus(),
      message: (e as HttpException).message,
    };
  }
  throw new Error('Expected a refusal');
};

describe('DelegateGrantService.authorize', () => {
  it('lets a delegate through without a grant', async () => {
    const { service } = setup({ grants: [] });
    await expect(
      service.authorize({ userId: 'd', roles: [Role.DELEGATE] }, 'DNF_ALL', {
        resultId: 'r-other',
      }),
    ).resolves.toBeNull();
  });

  it('refuses a user without any grant', async () => {
    const { service } = setup({ grants: [] });
    expect(
      await refusal(
        service.authorize(helper, 'RESOLVE_INCIDENT', {
          resultId: 'r-assigned',
        }),
      ),
    ).toEqual({ status: 403, message: 'Only delegates can do this' });
  });

  it('refuses while the group has not started', async () => {
    const { service } = setup({
      rooms: [{ id: 'room-1', currentGroupIds: [] }],
    });
    const { message } = await refusal(
      service.authorize(helper, 'RESOLVE_INCIDENT', { resultId: 'r-assigned' }),
    );
    expect(message).toMatch(/starts when the group starts/);
  });

  it('starts the grant when the group runs, and ends it for good after', async () => {
    const { service, state } = setup();
    await service.authorize(helper, 'RESOLVE_INCIDENT', {
      resultId: 'r-assigned',
    });
    // Scope starts with the group, not with the access: incidents raised
    // before the delegate gave it count too
    expect(state.grants[0].activatedAt).toEqual(GROUP_STARTED_AT);

    state.rooms[0].currentGroupIds = ['333-r1-g3'];
    const { message } = await refusal(
      service.authorize(helper, 'RESOLVE_INCIDENT', { resultId: 'r-assigned' }),
    );
    expect(message).toMatch(/has ended/);
    expect(state.grants[0].endedAt).not.toBeNull();

    // Starting the group again doesn't bring it back
    state.rooms[0].currentGroupIds = [GROUP];
    expect(
      (
        await refusal(
          service.authorize(helper, 'RESOLVE_INCIDENT', {
            resultId: 'r-assigned',
          }),
        )
      ).message,
    ).toMatch(/has ended/);
  });

  it('covers a competitor assigned to the group', async () => {
    const { service } = setup();
    await expect(
      service.authorize(helper, 'RESOLVE_INCIDENT', { resultId: 'r-assigned' }),
    ).resolves.toMatchObject({ id: 'grant-1' });
  });

  it('covers a competitor who solved in the room without being assigned', async () => {
    const { service } = setup();
    await expect(
      service.authorize(helper, 'GIVE_EXTRA', { resultId: 'r-walk-in' }),
    ).resolves.toMatchObject({ id: 'grant-1' });
  });

  it('refuses a competitor outside the group', async () => {
    const { service } = setup();
    const { message } = await refusal(
      service.authorize(helper, 'RESOLVE_INCIDENT', { resultId: 'r-other' }),
    );
    expect(message).toMatch(/doesn't cover this competitor/);
  });

  it('refuses the same competitor in another round', async () => {
    const { service } = setup();
    const { message } = await refusal(
      service.authorize(helper, 'RESOLVE_INCIDENT', {
        resultId: 'r-next-round',
      }),
    );
    expect(message).toMatch(/doesn't cover this competitor/);
  });

  it('refuses an action the delegate did not tick', async () => {
    const { service } = setup();
    const { status, message } = await refusal(
      service.authorize(helper, 'DELETE_ATTEMPT', { resultId: 'r-assigned' }),
    );
    expect(status).toBe(403);
    expect(message).toMatch(/doesn't include deleting attempts/);
  });

  it('allows a ticked action', async () => {
    const { service } = setup({
      grants: [grant({ permissions: ['DNF_ALL'] })],
    });
    await expect(
      service.authorize(helper, 'DNF_ALL', { resultId: 'r-assigned' }),
    ).resolves.toMatchObject({ id: 'grant-1' });
  });

  it('refuses after a delegate ended the grant', async () => {
    const { service } = setup({
      grants: [grant({ activatedAt: new Date(), endedAt: new Date() })],
    });
    const { message } = await refusal(
      service.authorize(helper, 'RESOLVE_INCIDENT', { resultId: 'r-assigned' }),
    );
    expect(message).toMatch(/has ended/);
  });
});

describe('DelegateGrantService.filterVisible', () => {
  const incident = (personId: string, roundId = ROUND) => ({
    result: { personId, roundId },
  });

  it('shows a grantee only the incidents the grant covers', async () => {
    const { service } = setup();
    const visible = await service.filterVisible(helper, [
      incident('assigned'),
      incident('walk-in'),
      incident('other'),
      incident('assigned', '333-r2'),
    ]);
    expect(visible).toEqual([incident('assigned'), incident('walk-in')]);
  });

  it('shows a delegate everything', async () => {
    const { service } = setup({ grants: [] });
    const all = [incident('other')];
    expect(
      await service.filterVisible({ userId: 'd', roles: [Role.ADMIN] }, all),
    ).toBe(all);
  });
});
