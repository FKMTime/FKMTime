import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { DeviceType } from '@prisma/client';
import { PersonService } from 'src/person/person.service';
import { PersonForDeviceService } from 'src/person/personForDevice.service';
import { ResultFromDeviceService } from 'src/result/resultFromDevice.service';
import { getRoundInfoFromWcif } from 'wcif-helpers';

import { AppGateway } from '../app.gateway';
import { AttendanceService } from '../attendance/attendance.service';
import { CreateAttendaceDto } from '../attendance/dto/createAttendance.dto';
import { CompetitionService } from '../competition/competition.service';
import { DeviceService } from '../device/device.service';
import { RequestToConnectDto } from '../device/dto/requestToConnect.dto';
import { UpdateBatteryPercentageDto } from '../device/dto/updateBatteryPercentage.dto';
import { CheckIfAttemptEnteredDto } from '../result/dto/checkIfAttemptEntered.dto';
import { EnterAttemptDto } from '../result/dto/enterAttempt.dto';
import { ResultService } from '../result/result.service';
import { CurrentTimeInfoDto } from './dto/currentTimeInfo.dto';

@Injectable()
export class SocketService {
  constructor(
    @Inject(forwardRef(() => ResultService))
    private readonly resultService: ResultService,
    @Inject(forwardRef(() => ResultFromDeviceService))
    private readonly resultFromDeviceService: ResultFromDeviceService,
    @Inject(forwardRef(() => DeviceService))
    private readonly deviceService: DeviceService,
    private readonly attendanceService: AttendanceService,
    @Inject(forwardRef(() => CompetitionService))
    private readonly competitionService: CompetitionService,
    private readonly personForDevice: PersonForDeviceService,
    private readonly personService: PersonService,
    @Inject(forwardRef(() => AppGateway))
    private readonly appGateway: AppGateway,
  ) {}

  async enterAttempt(data: EnterAttemptDto) {
    return await this.resultFromDeviceService.enterAttempt(data);
  }

  async requestToConnectDevice(data: RequestToConnectDto) {
    return await this.deviceService.requestToConnect(data);
  }

  async updateBatteryPercentage(data: UpdateBatteryPercentageDto) {
    return await this.deviceService.updateBatteryPercentage(data);
  }

  async createAttendance(data: CreateAttendaceDto) {
    return await this.attendanceService.createAttendance(data);
  }

  async getServerStatus() {
    return await this.competitionService.serverStatus();
  }

  async getAutoSetupSettings() {
    return await this.competitionService.getAutoSetupSettings();
  }

  async getPersonInfo(cardId: string, espId: number, isCompetitor: boolean) {
    return await this.personForDevice.getPersonInfo(
      cardId,
      espId,
      isCompetitor,
    );
  }

  async checkIfAttemptEntered(data: CheckIfAttemptEnteredDto) {
    return await this.resultService.checkIfAttemptEntered(data);
  }

  async handleCurrentTimeInfo(data: CurrentTimeInfoDto) {
    const device = await this.deviceService.getDeviceByEspId(
      data.espId,
      DeviceType.STATION,
    );
    const deviceName = device?.name ?? `Station ${data.espId}`;

    let personName: string | null = null;
    let registrantId: number | null = null;
    let personId: string | null = null;

    if (data.competitor != null) {
      const person = await this.personService.getPersonByCardId(
        data.competitor.toString(),
      );
      if (person) {
        personName = person.name;
        registrantId = person.registrantId ?? null;
        personId = person.id;
      }
    }

    let cumulativeLimitCentiseconds: number | null = null;
    let cumulativeRemainingCentiseconds: number | null = null;

    if (data.groupId && personId) {
      const roundId = data.groupId.split('-g')[0];
      const competition = await this.competitionService.getCompetitionInfo();
      const wcif = JSON.parse(JSON.stringify(competition.wcif));
      const roundInfo = getRoundInfoFromWcif(roundId, wcif);

      if (roundInfo?.timeLimit?.cumulativeRoundIds?.length > 0) {
        const roundsIds =
          roundInfo.timeLimit.cumulativeRoundIds.length > 1
            ? roundInfo.timeLimit.cumulativeRoundIds
            : [roundId];
        const used = await this.resultService.getCumulativeSumForMultipleRounds(
          personId,
          roundsIds,
        );
        cumulativeLimitCentiseconds = roundInfo.timeLimit.centiseconds;
        cumulativeRemainingCentiseconds = Math.max(
          0,
          roundInfo.timeLimit.centiseconds - used,
        );
      }
    }

    this.appGateway.broadcastCurrentTimeInfo({
      espId: data.espId,
      deviceName,
      personName,
      registrantId,
      groupId: data.groupId ?? null,
      time: data.time ?? null,
      inspection: data.inspection ?? null,
      cumulativeLimitCentiseconds,
      cumulativeRemainingCentiseconds,
      serverReceivedAt: Date.now(),
    });
  }
}
