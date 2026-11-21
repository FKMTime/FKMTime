import { Role } from '../generated/prisma/client';
import { SocketSessionSweepService } from './socketSessionSweep.service';

describe('SocketSessionSweepService', () => {
  const socketFor = (userId: string, roles: Role[]) => ({
    data: {
      session: {
        userId,
        roles,
        tokenVersion: 0,
        exp: Date.now() / 1000 + 3600,
      },
    },
    disconnect: jest.fn(),
  });

  it('disconnects sockets whose user lost access, and only those', async () => {
    const stillAdmin = socketFor('admin', [Role.ADMIN]);
    const demoted = socketFor('demoted', [Role.ADMIN]);
    const deleted = socketFor('deleted', [Role.ORGANIZER]);
    const anonymous = { data: {}, disconnect: jest.fn() };
    const gateway = {
      server: {
        fetchSockets: jest
          .fn()
          .mockResolvedValue([stillAdmin, demoted, deleted, anonymous]),
      },
    };
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'admin', roles: [Role.ADMIN], tokenVersion: 0 },
          { id: 'demoted', roles: [], tokenVersion: 0 },
        ]),
      },
    };

    await new SocketSessionSweepService(
      gateway as never,
      prisma as never,
    ).sweep();

    expect(stillAdmin.disconnect).not.toHaveBeenCalled();
    expect(demoted.disconnect).toHaveBeenCalledWith(true);
    expect(deleted.disconnect).toHaveBeenCalledWith(true);
    expect(anonymous.disconnect).not.toHaveBeenCalled();
  });
});
