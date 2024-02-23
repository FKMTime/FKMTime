import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { CompetitionService } from './competition.service';
import { UpdateCompetitionDto } from './dto/updateCompetition.dto';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from 'src/auth/guards/admin.guard';

@Controller('competition')
export class CompetitionController {
  constructor(private readonly competitionService: CompetitionService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get()
  async getCompetitionInfo() {
    return await this.competitionService.getCompetitionInfo();
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('rounds')
  async getCompetitionRounds() {
    return await this.competitionService.getRoundsInfo();
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('groups')
  async getCompetitionGroups() {
    return await this.competitionService.getAllGroups();
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('groups/:id')
  async updateCurrentGroup(@Param('id') id: string) {
    return await this.competitionService.updateCurrentGroup(id);
  }

  @UseGuards(AdminGuard)
  @Get('settings')
  async getCompetitionSettings() {
    return await this.competitionService.getCompetitionSettings();
  }

  @UseGuards(AdminGuard)
  @Get('import/:id')
  async importCompetition(@Param('id') id: string) {
    return await this.competitionService.importCompetition(id);
  }

  @Get('sync/:id')
  async syncCompetition(@Param('id') id: string) {
    return await this.competitionService.updateWcif(id);
  }

  @Put('update/:id')
  async updateCompetition(
    @Param('id') id: number,
    @Body() dto: UpdateCompetitionDto,
  ) {
    return await this.competitionService.updateCompetition(+id, dto);
  }
}
