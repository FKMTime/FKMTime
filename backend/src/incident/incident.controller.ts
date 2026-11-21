import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from 'src/auth/decorator/getUser.decorator';
import { JwtAuthDto } from 'src/auth/dto/jwt-auth.dto';
import { DelegateGuard } from 'src/auth/guards/delegate.guard';
import { DelegateOrGrantGuard } from 'src/auth/guards/delegateOrGrant.guard';
import { DelegateGrantService } from 'src/delegate-grant/delegateGrant.service';
import { TutorialIncidentService } from 'src/device/tutorialIncident.service';
import { ParseRoundIdPipe } from 'src/roundId.pipe';

import { ManualIncidentDto } from './dto/manualIncident.dto';
import { NoteworthyIncidentDto } from './dto/noteworthyIncident.dto';
import { ResolveTutorialIncidentDto } from './dto/resolveTutorialIncident.dto';
import { WarningDto } from './dto/warning.dto';
import { IncidentService } from './incident.service';

/**
 * Open incidents are also for users with delegate access for a group
 * (SPEC-013), filtered to the competitors it covers. Everything else here is
 * history or judgement about competitors, which stays with delegates.
 */
@UseGuards(AuthGuard('jwt'), DelegateOrGrantGuard)
@Controller('incident')
export class IncidentController {
  constructor(
    private readonly incidentService: IncidentService,
    private readonly tutorialIncidents: TutorialIncidentService,
    private readonly delegateGrants: DelegateGrantService,
  ) {}

  @Get('unresolved')
  async getUnresolvedAttempts(
    @GetUser() user: JwtAuthDto,
    @Query('roundId') roundId?: string,
  ) {
    return this.delegateGrants.filterVisible(
      user,
      await this.incidentService.getUnresolvedIncidents(roundId),
    );
  }

  @UseGuards(DelegateGuard)
  @Get('round/:roundId')
  async getIncidentsByRoundId(
    @Param('roundId', ParseRoundIdPipe) roundId: string,
  ) {
    return this.incidentService.getIncidentsByRoundId(roundId);
  }

  @Get('unresolved/count')
  async getUnresolvedIncidentsCount(@GetUser() user: JwtAuthDto) {
    const visible = await this.delegateGrants.filterVisible(
      user,
      await this.incidentService.getUnresolvedIncidents(),
    );
    // Waiting tutorial delegate calls count too (SPEC-012), for delegates:
    // delegate access for a group doesn't cover them (SPEC-013)
    const tutorial = this.delegateGrants.isDelegateUser(user)
      ? this.tutorialIncidents.count()
      : 0;
    return { count: visible.length + tutorial };
  }

  /** Delegate calls made during a tutorial, kept in memory (SPEC-012) */
  @UseGuards(DelegateGuard)
  @Get('tutorial')
  getTutorialIncidents() {
    return this.tutorialIncidents.getAll();
  }

  @UseGuards(DelegateGuard)
  @Put('tutorial/:id')
  resolveTutorialIncident(
    @Param('id') id: string,
    @Body() data: ResolveTutorialIncidentDto,
  ) {
    return this.tutorialIncidents.resolve(id, data);
  }

  @UseGuards(DelegateGuard)
  @Delete('tutorial/:id')
  deleteTutorialIncident(@Param('id') id: string) {
    return this.tutorialIncidents.remove(id);
  }

  @UseGuards(DelegateGuard)
  @Get('person/:id')
  async getIncidentsForPerson(@Param('id') personId: string) {
    return this.incidentService.getIncidentsForPerson(personId);
  }

  @UseGuards(DelegateGuard)
  @Get('resolved')
  async getResolvedIncidents(@Query('search') search: string) {
    return this.incidentService.getResolvedIncidents(search);
  }

  @UseGuards(DelegateGuard)
  @Get('noteworthy')
  async getNoteworthyIncidents(@Query('search') search: string) {
    return this.incidentService.getNoteworthyIncidents(search);
  }

  @UseGuards(DelegateGuard)
  @Post('noteworthy')
  async createNoteworthyIncident(
    @GetUser() user: JwtAuthDto,
    @Body() data: NoteworthyIncidentDto,
  ) {
    return this.incidentService.createNoteworthyIncident(data, user.userId);
  }

  @UseGuards(DelegateGuard)
  @Put('noteworthy/:id')
  async updateNoteworthyIncident(
    @Param('id') id: string,
    @Body() data: NoteworthyIncidentDto,
  ) {
    return this.incidentService.updateNoteworthyIncident(id, data);
  }

  @UseGuards(DelegateGuard)
  @Post('noteworthy/save/:id')
  async addAttemptAsNoteworthyIncident(
    @Param('id') attemptId: string,
    @GetUser() user: JwtAuthDto,
  ) {
    return this.incidentService.addAttemptAsNoteworthyIncident(
      attemptId,
      user.userId,
    );
  }

  @UseGuards(DelegateGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('noteworthy/:id')
  async deleteNoteworthyIncident(@Param('id') id: string) {
    return this.incidentService.deleteNoteworthyIncident(id);
  }

  @UseGuards(DelegateGuard)
  @Get('warnings')
  async getAllWarnings(@Query('search') search: string) {
    return this.incidentService.getAllWarnings(search);
  }

  @UseGuards(DelegateGuard)
  @Get('warnings/person/:id')
  async getWarningsByPerson(@Param('id') personId: string) {
    return this.incidentService.getWarningsForPerson(personId);
  }

  @UseGuards(DelegateGuard)
  @Post('warnings/person/:id')
  async addWarningToPerson(
    @Param('id') personId: string,
    @Body() data: WarningDto,
    @GetUser() user: JwtAuthDto,
  ) {
    return this.incidentService.issueWarning(personId, data, user.userId);
  }

  @UseGuards(DelegateGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('warnings/:id')
  async deleteWarning(@Param('id') id: string) {
    return this.incidentService.deleteWarning(id);
  }

  @UseGuards(DelegateGuard)
  @Get('manual')
  async getManualIncidents(@Query('search') search: string) {
    return this.incidentService.getManualIncidents(search);
  }

  @UseGuards(DelegateGuard)
  @Post('manual')
  async createManualIncident(
    @GetUser() user: JwtAuthDto,
    @Body() data: ManualIncidentDto,
  ) {
    return this.incidentService.createManualIncident(data, user.userId);
  }

  @UseGuards(DelegateGuard)
  @Put('manual/:id')
  async updateManualIncident(
    @Param('id') id: string,
    @Body() data: ManualIncidentDto,
  ) {
    return this.incidentService.updateManualIncident(id, data);
  }

  @UseGuards(DelegateGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('manual/:id')
  async deleteManualIncident(@Param('id') id: string) {
    return this.incidentService.deleteManualIncident(id);
  }
}
