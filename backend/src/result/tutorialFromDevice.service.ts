import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { DeviceType } from '@prisma/client';
import { DbService } from 'src/db/db.service';
import { DeviceService } from 'src/device/device.service';
import { isInTutorial, TUTORIAL_GROUP_ID } from 'src/device/tutorial';
import { TutorialIncidentService } from 'src/device/tutorialIncident.service';
import { PersonService } from 'src/person/person.service';
import { getTranslation } from 'src/translations/translations';

import { EnterAttemptDto } from './dto/enterAttempt.dto';
import { getReaderLocale } from './helpers';

/**
 * Solves from a station in tutorial mode: the cards are checked as for a real
 * solve, and nothing is saved (SPEC-012)
 */
@Injectable()
export class TutorialFromDeviceService {
  constructor(
    private readonly prisma: DbService,
    private readonly personService: PersonService,
    @Inject(forwardRef(() => DeviceService))
    private readonly deviceService: DeviceService,
    private readonly tutorialIncidents: TutorialIncidentService,
  ) {}

  /**
   * The group given at the card scan decides. A solve without one (firmware
   * that doesn't send it) follows the station's mode when it arrives
   */
  async isTutorialAttempt(data: EnterAttemptDto) {
    if (data.groupId) return data.groupId === TUTORIAL_GROUP_ID;
    const device = await this.deviceService.getDeviceByEspId(
      data.espId,
      DeviceType.STATION,
    );
    return isInTutorial(device);
  }

  async enterAttempt(data: EnterAttemptDto) {
    const competition = await this.prisma.competition.findFirst();
    if (!competition) {
      return {
        message: getTranslation('competitionNotFound', 'en'),
        shouldResetTime: true,
        status: 404,
        error: true,
        errorDetails: { key: 'competitionNotFound' },
      };
    }
    let locale = competition.defaultLocale;
    const device = await this.deviceService.getDeviceByEspId(
      data.espId,
      DeviceType.STATION,
    );
    if (!device) {
      return {
        message: getTranslation('stationNotFound', locale),
        shouldResetTime: false,
        status: 404,
        error: true,
        errorDetails: { key: 'stationNotFound' },
      };
    }
    const competitor = await this.personService.getPersonByCardId(
      data.competitorId.toString(),
    );
    if (!competitor) {
      return {
        message: getTranslation('competitorNotFound', locale),
        shouldResetTime: true,
        status: 404,
        error: true,
        errorDetails: { key: 'competitorNotFound', cardId: data.competitorId },
      };
    }
    const judge = data.judgeId
      ? await this.personService.getPersonByCardId(data.judgeId.toString())
      : null;
    if (!judge && !data.isDelegate) {
      return {
        message: getTranslation('judgeNotFound', locale),
        shouldResetTime: false,
        status: 404,
        error: true,
        errorDetails: { key: 'judgeNotFound', cardId: data.judgeId ?? null },
      };
    }
    locale = getReaderLocale(competitor, judge, competition.defaultLocale);
    if (judge && judge.id === competitor.id) {
      return {
        message: getTranslation('judgeIsCompetitor', locale),
        shouldResetTime: false,
        status: 400,
        error: true,
        errorDetails: {
          key: 'judgeIsCompetitor',
          competitorName: competitor.name,
        },
      };
    }

    await this.deviceService.extendTutorial(device.id);
    if (data.isDelegate) {
      this.tutorialIncidents.record({
        espId: data.espId,
        deviceName: device.name,
        roomId: device.roomId,
        competitorName: competitor.name,
        judgeName: judge?.name ?? null,
        value: data.value,
        penalty: data.penalty,
        inspectionTime: data.inspectionTime,
        sessionId: data.sessionId,
      });
      return {
        message: getTranslation('delegateWasNotified', locale),
        status: 200,
        error: false,
      };
    }
    return {
      message: getTranslation('tutorialAttemptEntered', locale),
      shouldResetTime: true,
      status: 200,
      error: false,
    };
  }
}
