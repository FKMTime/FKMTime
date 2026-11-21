import { Role } from '../generated/prisma/client';
import { JwtAuthDto } from './dto/jwt-auth.dto';

/** Who a socket.io connection belongs to, recorded when a guard admits it */
export interface SocketSession {
  userId: string;
  /** Sorted, to compare with the user's current roles */
  roles: Role[];
  tokenVersion: number;
  /** Token expiry, in seconds since epoch */
  exp?: number;
}

const sortedRoles = (roles: Role[]) => [...roles].sort();

/**
 * Remembers the user on a socket the first time a guard checks it, so the
 * session sweep can disconnect it once that access ends. Rooms joined over
 * the socket keep receiving pushes otherwise.
 */
export const rememberSocketSession = (req: unknown, user: JwtAuthDto) => {
  if (!req || typeof req !== 'object' || !('handshake' in req)) return;
  const socket = req as { data?: { session?: SocketSession } };
  if (!socket.data) return;
  socket.data.session = {
    userId: user.userId,
    roles: sortedRoles(user.roles),
    tokenVersion: user.tokenVersion ?? 0,
    exp: user.exp,
  };
};

/** Whether the session a socket was admitted with still holds */
export const isSocketSessionCurrent = (
  session: SocketSession,
  user: { roles: Role[]; tokenVersion: number } | undefined,
  nowSeconds: number,
) =>
  !!user &&
  user.tokenVersion === session.tokenVersion &&
  sortedRoles(user.roles).join(',') === session.roles.join(',') &&
  (session.exp === undefined || session.exp > nowSeconds);
