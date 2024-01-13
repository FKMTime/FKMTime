import { DbService } from './../db/db.service';
import { HttpException, Injectable } from '@nestjs/common';
import { UpdateCompetitionDto } from './dto/updateCompetition.dto';

const WCA_ORIGIN = `${process.env.WCA_ORIGIN}/api/v0/competitions/`;
@Injectable()
export class CompetitionService {
  constructor(private readonly prisma: DbService) {}

  async importCompetition(wcaId: string) {
    const wcifRes = await fetch(`${WCA_ORIGIN}${wcaId}/wcif/public`);
    const wcif = await wcifRes.json();
    const competition = await this.prisma.competition.create({
      data: {
        name: wcif.name,
        wcaId: wcif.id,
        shortName: wcif.shortName,
        countryIso2: wcif.countryIso2,
        wcif: wcif,
      },
    });
    await this.prisma.person.createMany({
      data: wcif.persons.map((person) => ({
        wcaId: person.wcaId,
        name: person.name,
        registrantId: person.registrantId,
        gender: person.gender,
        countryIso2: person.countryIso2,
      })),
    });
    return competition;
  }

  async updateWcif(wcaId: string) {
    const wcifRes = await fetch(`${WCA_ORIGIN}${wcaId}/wcif/public`);
    const wcif = await wcifRes.json();
    await this.prisma.competition.updateMany({
      where: { wcaId },
      data: {
        name: wcif.name,
        shortName: wcif.shortName,
        countryIso2: wcif.countryIso2,
        wcif: wcif,
      },
    });
  }

  async getCompetitionInfo() {
    const competition = await this.prisma.competition.findFirst();
    if (!competition) {
      throw new HttpException('Competition not found', 404);
    }
    return competition;
  }

  async updateCompetition(id: number, dto: UpdateCompetitionDto) {
    return await this.prisma.competition.update({
      where: {
        id: id,
      },
      data: {
        scoretakingToken: dto.scoretakingToken,
        currentGroupId: dto.currentGroupId,
      },
    });
  }
}
