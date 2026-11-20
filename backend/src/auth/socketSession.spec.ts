import { Role } from '@prisma/client';

import {
  isSocketSessionCurrent,
  rememberSocketSession,
  SocketSession,
} from './socketSession';

describe('socket sessions', () => {
  const session: SocketSession = {
    userId: 'u1',
    roles: [Role.ADMIN],
    tokenVersion: 0,
    exp: 2000,
  };

  it('remembers the user on a socket, not on an HTTP request', () => {
    const socket = { handshake: {}, data: {} as Record<string, unknown> };
    const httpRequest = { headers: {} } as Record<string, unknown>;
    const user = {
      userId: 'u1',
      roles: [Role.DELEGATE, Role.ADMIN],
      tokenVersion: 2,
      exp: 50,
    };

    rememberSocketSession(socket, user);
    rememberSocketSession(httpRequest, user);

    expect(socket.data.session).toEqual({
      userId: 'u1',
      roles: [Role.ADMIN, Role.DELEGATE],
      tokenVersion: 2,
      exp: 50,
    });
    expect(httpRequest.data).toBeUndefined();
  });

  it('holds while nothing about the user changed', () => {
    expect(
      isSocketSessionCurrent(
        session,
        { roles: [Role.ADMIN], tokenVersion: 0 },
        1000,
      ),
    ).toBe(true);
  });

  it.each([
    ['the user was deleted', undefined, 1000],
    ['the roles changed', { roles: [], tokenVersion: 0 }, 1000],
    ['the password changed', { roles: [Role.ADMIN], tokenVersion: 1 }, 1000],
    ['the token expired', { roles: [Role.ADMIN], tokenVersion: 0 }, 3000],
  ])('ends when %s', (_, user, now) => {
    expect(isSocketSessionCurrent(session, user as never, now)).toBe(false);
  });
});
