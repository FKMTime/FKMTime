import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { StageLeaderGuard } from 'src/auth/guards/stageLeader.guard';

import { AttendanceScopeService } from './attendanceScope.service';

/**
 * For joining a group's live attendance over socket.io: stage leads and
 * above, and a stage lead only for a group in their rooms (SPEC-016)
 */
@Injectable()
export class AttendanceGroupGuard implements CanActivate {
  constructor(
    private readonly stageLeaderGuard: StageLeaderGuard,
    private readonly scope: AttendanceScopeService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!(await this.stageLeaderGuard.canActivate(context))) return false;
    const socket = context.switchToWs().getClient();
    const userId: string | undefined = socket.data?.session?.userId;
    const groupId: unknown = context.switchToWs().getData()?.groupId;
    if (!userId || typeof groupId !== 'string') {
      throw new ForbiddenException();
    }
    await this.scope.assertGroup(userId, groupId);
    return true;
  }
}
