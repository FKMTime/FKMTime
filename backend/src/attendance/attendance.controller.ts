import {
  Body,
  Controller,
  forwardRef,
  Get,
  Inject,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from 'src/auth/decorator/getUser.decorator';
import { JwtAuthDto } from 'src/auth/dto/jwt-auth.dto';
import { StageLeaderGuard } from 'src/auth/guards/stageLeader.guard';
import { CompetitionService } from 'src/competition/competition.service';
import { ParseRoundIdPipe } from 'src/roundId.pipe';

import { StaffRole } from '../generated/prisma/client';
import { AttendanceService } from './attendance.service';
import { AttendanceScopeService } from './attendanceScope.service';
import { AddNotAssignedPersonDto } from './dto/addNotAssignedPerson.dto';
import { MarkReplacedDto } from './dto/markReplaced.dto';
import { RestoreAttendanceDto } from './dto/restoreAttendance.dto';
import { SetLeftEarlyDto } from './dto/setLeftEarly.dto';
import { SetNoShowDto } from './dto/setNoShow.dto';
import { UpdateCommentDto } from './dto/updateComment.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly scope: AttendanceScopeService,
    @Inject(forwardRef(() => CompetitionService))
    private readonly competitionService: CompetitionService,
  ) {}

  /** Which groups the caller takes attendance for (SPEC-016) */
  @UseGuards(StageLeaderGuard)
  @Get('scope')
  async getScope(@GetUser() user: JwtAuthDto) {
    return this.scope.describe(user.userId);
  }

  @UseGuards(StageLeaderGuard)
  @Get('group/:groupId')
  async getAttendanceByGroupId(
    @Param('groupId') groupId: string,
    @GetUser() user: JwtAuthDto,
  ) {
    await this.scope.assertGroup(user.userId, groupId);
    return this.attendanceService.getAttendanceByGroupId(groupId);
  }

  @UseGuards(StageLeaderGuard)
  @Get('round/:roundId/staffing')
  async getRoundStaffing(
    @Param('roundId', ParseRoundIdPipe) roundId: string,
    @GetUser() user: JwtAuthDto,
  ) {
    await this.scope.assertRound(user.userId, roundId);
    return this.attendanceService.getRoundStaffing(roundId);
  }

  @UseGuards(StageLeaderGuard)
  @Get('statistics')
  async getAttendanceStatistics() {
    return this.attendanceService.getAttendanceStatistics();
  }

  @UseGuards(StageLeaderGuard)
  @Get('missed')
  async getMostMissedAssignments() {
    return this.attendanceService.getMostMissedAssignments();
  }

  @UseGuards(StageLeaderGuard)
  @Get('person/:id')
  /**
   * Every room's rows, also for a stage lead: reading changes nothing, and
   * "no-show for the day" needs the whole day (SPEC-016). The person page
   * shows only the stage lead's rooms.
   */
  async getStaffActivitiesByPersonId(@Param('id') id: string) {
    return this.attendanceService.getStaffActivitiesByPersonId(id);
  }

  @UseGuards(StageLeaderGuard)
  @Post('unassigned/:groupId')
  async addUnassignedPerson(
    @Param('groupId') groupId: string,
    @Body() data: AddNotAssignedPersonDto,
    @GetUser() user: JwtAuthDto,
  ) {
    await this.scope.assertGroup(user.userId, groupId);
    return this.attendanceService.addNotAssignedPerson(groupId, data);
  }

  @UseGuards(StageLeaderGuard)
  @Post('present/:id')
  async markAsPresent(@Param('id') id: string, @GetUser() user: JwtAuthDto) {
    await this.scope.assertActivity(user.userId, id);
    return this.attendanceService.markAsPresent(id);
  }

  @UseGuards(StageLeaderGuard)
  @Post('absent/:id')
  async markAsAbsent(@Param('id') id: string, @GetUser() user: JwtAuthDto) {
    await this.scope.assertActivity(user.userId, id);
    return this.attendanceService.markAsAbsent(id);
  }

  @UseGuards(StageLeaderGuard)
  @Post('replaced/:id')
  async markAsReplaced(
    @Param('id') id: string,
    @Body() data: MarkReplacedDto,
    @GetUser() user: JwtAuthDto,
  ) {
    await this.scope.assertActivity(user.userId, id);
    return this.attendanceService.markAsReplaced(id, data);
  }

  @UseGuards(StageLeaderGuard)
  @Put('left-early/:id')
  async setLeftEarly(
    @Param('id') id: string,
    @Body() data: SetLeftEarlyDto,
    @GetUser() user: JwtAuthDto,
  ) {
    await this.scope.assertActivity(user.userId, id);
    return this.attendanceService.setLeftEarly(id, data.leftEarly);
  }

  @UseGuards(StageLeaderGuard)
  @Post('no-show')
  async setNoShow(@Body() data: SetNoShowDto, @GetUser() user: JwtAuthDto) {
    // Not coming is about the person, so a stage lead tags the whole day once
    // one of its groups is in their rooms (SPEC-016)
    await this.scope.assertAnyGroup(user.userId, data.groupIds);
    const result = await this.attendanceService.setNoShow(data);
    // A group may have been waiting only for them
    if (data.role === StaffRole.COMPETITOR && data.noShow) {
      new Set(data.groupIds.map((id) => id.split('-g')[0])).forEach((roundId) =>
        this.competitionService.requestGroupChangeCheck(roundId),
      );
    }
    return result;
  }

  @UseGuards(StageLeaderGuard)
  @Put('restore/:id')
  async restore(
    @Param('id') id: string,
    @Body() data: RestoreAttendanceDto,
    @GetUser() user: JwtAuthDto,
  ) {
    await this.scope.assertActivity(user.userId, id);
    return this.attendanceService.restore(id, data);
  }

  @UseGuards(StageLeaderGuard)
  @Post('late/:id')
  async markAsLate(@Param('id') id: string, @GetUser() user: JwtAuthDto) {
    await this.scope.assertActivity(user.userId, id);
    return this.attendanceService.markAsLate(id);
  }

  @UseGuards(StageLeaderGuard)
  @Put('comment/:id')
  async updateComment(
    @Param('id') id: string,
    @Body() updateCommentDto: UpdateCommentDto,
    @GetUser() user: JwtAuthDto,
  ) {
    await this.scope.assertActivity(user.userId, id);
    return this.attendanceService.updateComment(id, updateCommentDto);
  }
}
