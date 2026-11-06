import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { StageLeaderGuard } from 'src/auth/guards/stageLeader.guard';

import { AttendanceService } from './attendance.service';
import { AddNotAssignedPersonDto } from './dto/addNotAssignedPerson.dto';
import { MarkReplacedDto } from './dto/markReplaced.dto';
import { RestoreAttendanceDto } from './dto/restoreAttendance.dto';
import { SetLeftEarlyDto } from './dto/setLeftEarly.dto';
import { SetNoShowDto } from './dto/setNoShow.dto';
import { UpdateCommentDto } from './dto/updateComment.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @UseGuards(StageLeaderGuard)
  @Get('group/:groupId')
  async getAttendanceByGroupId(@Param('groupId') groupId: string) {
    return this.attendanceService.getAttendanceByGroupId(groupId);
  }

  @UseGuards(StageLeaderGuard)
  @Get('round/:roundId/staffing')
  async getRoundStaffing(@Param('roundId') roundId: string) {
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
  async getStaffActivitiesByPersonId(@Param('id') id: string) {
    return this.attendanceService.getStaffActivitiesByPersonId(id);
  }

  @UseGuards(StageLeaderGuard)
  @Post('unassigned/:groupId')
  async addUnassignedPerson(
    @Param('groupId') groupId: string,
    @Body() data: AddNotAssignedPersonDto,
  ) {
    return this.attendanceService.addNotAssignedPerson(groupId, data);
  }

  @UseGuards(StageLeaderGuard)
  @Post('present/:id')
  async markAsPresent(@Param('id') id: string) {
    return this.attendanceService.markAsPresent(id);
  }

  @UseGuards(StageLeaderGuard)
  @Post('absent/:id')
  async markAsAbsent(@Param('id') id: string) {
    return this.attendanceService.markAsAbsent(id);
  }

  @UseGuards(StageLeaderGuard)
  @Post('replaced/:id')
  async markAsReplaced(@Param('id') id: string, @Body() data: MarkReplacedDto) {
    return this.attendanceService.markAsReplaced(id, data);
  }

  @UseGuards(StageLeaderGuard)
  @Put('left-early/:id')
  async setLeftEarly(@Param('id') id: string, @Body() data: SetLeftEarlyDto) {
    return this.attendanceService.setLeftEarly(id, data.leftEarly);
  }

  @UseGuards(StageLeaderGuard)
  @Post('no-show')
  async setNoShow(@Body() data: SetNoShowDto) {
    return this.attendanceService.setNoShow(data);
  }

  @UseGuards(StageLeaderGuard)
  @Put('restore/:id')
  async restore(@Param('id') id: string, @Body() data: RestoreAttendanceDto) {
    return this.attendanceService.restore(id, data);
  }

  @UseGuards(StageLeaderGuard)
  @Post('late/:id')
  async markAsLate(@Param('id') id: string) {
    return this.attendanceService.markAsLate(id);
  }

  @UseGuards(StageLeaderGuard)
  @Put('comment/:id')
  async updateComment(
    @Param('id') id: string,
    @Body() updateCommentDto: UpdateCommentDto,
  ) {
    return this.attendanceService.updateComment(id, updateCommentDto);
  }
}
