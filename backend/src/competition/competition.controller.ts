import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { CompetitionService } from './competition.service';
import { AdminGuard } from 'src/auth/guards/admin.guard';
import { UpdateCompetitionDto } from './dto/updateCompetition.dto';

@UseGuards(AdminGuard)
@Controller('competition')
export class CompetitionController {
  constructor(private readonly competitionService: CompetitionService) {}

  @Get()
  async getCompetitionInfo() {
    return await this.competitionService.getCompetitionInfo();
  }
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
