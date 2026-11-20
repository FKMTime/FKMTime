import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

import { AppGateway } from '../app.gateway';
import { DbService } from '../db/db.service';
import { isSocketSessionCurrent, SocketSession } from './socketSession';

/**
 * Role guards on socket.io run when a client joins a room, but the room keeps
 * receiving pushes afterwards. Every few seconds this disconnects sockets whose
 * user was deleted, changed roles or password, or whose token expired; the
 * client reconnects and has to join again under its current access.
 */
@Injectable()
export class SocketSessionSweepService {
  private readonly logger = new Logger(SocketSessionSweepService.name);

  constructor(
    private readonly appGateway: AppGateway,
    private readonly prisma: DbService,
  ) {}

  @Interval(15_000)
  async sweep() {
    const server = this.appGateway.server;
    if (!server) return;
    const sockets = (await server.fetchSockets()).filter(
      (socket) => socket.data?.session,
    );
    if (sockets.length === 0) return;
    const userIds = [
      ...new Set(
        sockets.map((socket) => (socket.data.session as SocketSession).userId),
      ),
    ];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, roles: true, tokenVersion: true },
    });
    const byId = new Map(users.map((user) => [user.id, user]));
    const now = Date.now() / 1000;
    for (const socket of sockets) {
      const session = socket.data.session as SocketSession;
      if (!isSocketSessionCurrent(session, byId.get(session.userId), now)) {
        this.logger.log(`Ending a socket session of user ${session.userId}`);
        socket.disconnect(true);
      }
    }
  }
}
