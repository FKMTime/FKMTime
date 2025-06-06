import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { PersonForDeviceService } from 'src/person/personForDevice.service';
import { ResultFromDeviceService } from 'src/result/resultFromDevice.service';

import { AttendanceService } from '../attendance/attendance.service';
import { CreateAttendaceDto } from '../attendance/dto/createAttendance.dto';
import { CompetitionService } from '../competition/competition.service';
import { DeviceService } from '../device/device.service';
import { RequestToConnectDto } from '../device/dto/requestToConnect.dto';
import { UpdateBatteryPercentageDto } from '../device/dto/updateBatteryPercentage.dto';
import { CheckIfAttemptEnteredDto } from '../result/dto/checkIfAttemptEntered.dto';
import { EnterAttemptDto } from '../result/dto/enterAttempt.dto';
import { ResultService } from '../result/result.service';

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

  async getPersonInfo(cardId: string, espId: number) {
    return await this.personForDevice.getPersonInfo(cardId, espId);
  }

  async checkIfAttemptEntered(data: CheckIfAttemptEnteredDto) {
    return await this.resultService.checkIfAttemptEntered(data);
  }
}
