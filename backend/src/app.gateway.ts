import { Logger, UseGuards } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { DelegateGuard } from './auth/guards/delegate.guard';
import { OrganizerGuard } from './auth/guards/organizer.guard';
import { AUTO_SETUP_DURATION_MS } from './competition/autoSetup';
import { DeviceRequest } from './device/dto/requestToConnect.dto';
import type { DeviceErrorEvent } from './device/stationError.service';
import type { DeviceSignalEvent } from './device/stationSignal.service';
import type { TutorialNotice } from './device/tutorial';

/** The last attempt a station entered, kept to show after it resets */
export interface LastSolve {
  personName: string;
  /** Centiseconds, before the penalty */
  value: number;
  /** Seconds added, as stored on attempts; -1 for DNF */
  penalty: number;
  /** Which solve of the round it was; an extra counts its own */
  attemptNumber: number;
  isExtra: boolean;
}

export interface StationInfo {
  espId: number;
  deviceName: string;
  roomId: string | null;
  personName: string | null;
  registrantId: number | null;
  groupId: string | null;
  time: number | null;
  inspection: number | null;
  /** Whether the solve timer is running; null when the firmware doesn't say */
  timerRunning: boolean | null;
  /** Whether inspection is running; null when the firmware doesn't say */
  inspectionRunning: boolean | null;
  cumulativeLimitCentiseconds: number | null;
  cumulativeRemainingCentiseconds: number | null;
  serverReceivedAt: number;
  lastSolve: LastSolve | null;
}

@WebSocketGateway({
  namespace: '/',
  transports: ['websocket'],
  cors: {
    origin: '*',
  },
})
export class AppGateway {
  @WebSocketServer() server: Server;
  deviceRequests: DeviceRequest[] = [];
  /** When auto setup switches itself off, in ms since epoch; null while off */
  autoSetupEndsAt: number | null = null;
  private stations: Map<number, StationInfo> = new Map();
  private lastSolves: Map<number, LastSolve> = new Map();
  private logger = new Logger(`AppGateway`);

  /* ====================== */
  /* ======= Results ====== */
  /* ====================== */
  @SubscribeMessage('joinResults')
  async handleJoinResults(
    @ConnectedSocket() socket: Socket,
    @MessageBody('roundId') roundId: string,
  ) {
    socket.join(`results-${roundId}`);
  }

  @SubscribeMessage('leaveResults')
  async handleLeaveResults(
    @ConnectedSocket() socket: Socket,
    @MessageBody('roundId') roundId: string,
  ) {
    socket.leave(`results-${roundId}`);
  }

  // Server-side only: a round started but isn't open in WCA Integrated Live
  // Results; blockers say what argues against opening it yet
  handleRoundShouldBeOpened(roundId: string, blockers: string[]) {
    this.server
      .to(`competition`)
      .emit('roundShouldBeOpened', { roundId, blockers });
  }

  // Server-side only: a round was opened or closed, or someone added to one
  handleIntegratedLiveRoundsChanged() {
    this.server.to(`competition`).emit('integratedLiveRoundsChanged');
  }

  // Server-side only: the WCA live results connection was made, ended or broke
  handleIntegratedLiveConnectionChanged() {
    this.server.to(`competition`).emit('integratedLiveConnectionChanged');
  }

  // Server-side only: the WCA website now names another scoretaking tool
  handleScoretakingSoftwareChanged(officialResultsDestination: string) {
    this.server
      .to(`competition`)
      .emit('scoretakingSoftwareChanged', { officialResultsDestination });
  }

  // Server-side only: called after a result is saved, never by clients
  handleResultEntered(roundId: string) {
    this.handleStatisticsUpdated();
    this.server.to(`results-${roundId}`).emit('resultEntered');
  }

  /* ====================== */
  /* ======= Devices ====== */
  /* ====================== */
  @SubscribeMessage('joinDevices')
  @UseGuards(OrganizerGuard)
  async handleJoinDevices(@ConnectedSocket() socket: Socket) {
    socket.join(`device`);
    this.sendDeviceRequests(socket);
    socket.emit('autoSetupStatus', this.autoSetupStatus());
  }

  // Server-side only: auto setup was switched on, off, or ran out
  setAutoSetupEndsAt(endsAt: number | null) {
    this.autoSetupEndsAt = endsAt;
    this.server.to(`device`).emit('autoSetupStatus', this.autoSetupStatus());
  }

  // Time left rather than the deadline, so a panel whose clock is off by a
  // few minutes still counts down correctly
  private autoSetupStatus() {
    return {
      remainingMs:
        this.autoSetupEndsAt === null
          ? null
          : Math.max(0, this.autoSetupEndsAt - Date.now()),
      durationMs: AUTO_SETUP_DURATION_MS,
    };
  }

  @SubscribeMessage('leaveDevices')
  @UseGuards(OrganizerGuard)
  async handleLeaveDevices(@ConnectedSocket() socket: Socket) {
    socket.leave(`device`);
  }

  @SubscribeMessage('deviceUpdated')
  @UseGuards(OrganizerGuard)
  handleDeviceUpdated() {
    this.server.to(`device`).emit('deviceUpdated');
  }

  // Server-side only: a station's Wi-Fi signal, patched in place on the
  // Devices page instead of refetching the list like deviceUpdated (SPEC-008)
  handleDeviceSignal(signal: DeviceSignalEvent) {
    this.server.to(`device`).emit('deviceSignal', signal);
  }

  // Server-side only: a station's last error, patched in place on the
  // Devices page like deviceSignal (SPEC-010)
  handleDeviceError(event: DeviceErrorEvent) {
    this.server.to(`device`).emit('deviceError', event);
  }

  @SubscribeMessage('deviceRequests')
  @UseGuards(OrganizerGuard)
  sendDeviceRequests(@ConnectedSocket() socket: Socket) {
    socket.emit('deviceRequests', this.deviceRequests);
  }

  @UseGuards(OrganizerGuard)
  handleDeviceRequest(device: DeviceRequest) {
    const pending = this.deviceRequests.find(
      (req) => req.espId === device.espId,
    );
    if (
      pending &&
      pending.signKey === device.signKey &&
      pending.type === device.type &&
      pending.hw === device.hw &&
      pending.existingDevice?.id === device.existingDevice?.id
    )
      return;
    // a reset device asks again with a new sign key; approving the old request would
    // store a key the device no longer has, so only its latest request is kept
    this.deviceRequests = [
      ...this.deviceRequests.filter((req) => req.espId !== device.espId),
      device,
    ];
    this.server.to(`device`).emit('deviceRequests', this.deviceRequests);
  }

  getDeviceRequest(espId: number) {
    return this.deviceRequests.find((req) => req.espId === espId);
  }

  @SubscribeMessage('removeDeviceRequest')
  @UseGuards(OrganizerGuard)
  handleRemoveDeviceRequest(@MessageBody() data: { espId: number }) {
    this.deviceRequests = this.deviceRequests.filter(
      (device) => device.espId !== data.espId,
    );
    this.server.to(`device`).emit('deviceRequests', this.deviceRequests);
  }

  @UseGuards(OrganizerGuard)
  handleAddDeviceToDb(deviceId: number) {
    this.deviceRequests = this.deviceRequests.filter(
      (device) => device.espId !== deviceId,
    );
    this.server.to(`device`).emit('deviceRequests', this.deviceRequests);
  }

  /* ====================== */
  /* ==== Competition ===== */
  /* ====================== */
  @SubscribeMessage('joinCompetition')
  @UseGuards(OrganizerGuard)
  async handleJoinCompetition(@ConnectedSocket() socket: Socket) {
    socket.join(`competition`);
  }

  @SubscribeMessage('leaveCompetition')
  @UseGuards(OrganizerGuard)
  async handleLeaveCompetition(@ConnectedSocket() socket: Socket) {
    socket.leave(`competition`);
  }

  /* ====================== */
  /* ==== Statistics ===== */
  /* ====================== */
  @SubscribeMessage('joinStatistics')
  @UseGuards(OrganizerGuard)
  async handleJoinStatistics(@ConnectedSocket() socket: Socket) {
    socket.join(`statistics`);
  }

  @SubscribeMessage('leaveStatistics')
  @UseGuards(OrganizerGuard)
  async handleLeaveStatistics(@ConnectedSocket() socket: Socket) {
    socket.leave(`statistics`);
  }

  handleStatisticsUpdated() {
    this.server.to(`competition`).emit('statisticsUpdated');
  }

  /* ====================== */
  /* ===== Attendance ===== */
  /* ====================== */
  @SubscribeMessage('joinAttendance')
  @UseGuards(OrganizerGuard)
  async handleJoinAttendance(
    @ConnectedSocket() socket: Socket,
    @MessageBody('groupId') groupId: string,
  ) {
    socket.join(`attendance-${groupId}`);
  }

  @SubscribeMessage('leaveAttendance')
  @UseGuards(OrganizerGuard)
  async handleLeaveAttentance(
    @ConnectedSocket() socket: Socket,
    @MessageBody('groupId') groupId: string,
  ) {
    socket.leave(`attendance-${groupId}`);
  }

  @UseGuards(OrganizerGuard)
  handleNewAttendance(groupId: string, competitorId: string) {
    this.server.to(`attendance-${groupId}`).emit('newAttendance', {
      competitorId,
    });
  }

  /* ====================== */
  /* ====== Incidents ===== */
  /* ====================== */
  @SubscribeMessage('joinIncidents')
  @UseGuards(DelegateGuard)
  async handleJoinIncidents(@ConnectedSocket() socket: Socket) {
    socket.join(`incidents`);
  }

  @SubscribeMessage('leaveIncidents')
  @UseGuards(DelegateGuard)
  async handleLeaveIncidents(@ConnectedSocket() socket: Socket) {
    socket.leave(`incidents`);
  }

  // Server-side only: called when a station calls a delegate
  handleNewIncident(
    deviceName: string,
    competitorName: string,
    attemptId: string,
    isTutorial = false,
  ) {
    this.logger.log(
      `New ${isTutorial ? 'tutorial ' : ''}incident on station ${deviceName} - ${competitorName}`,
    );
    // Only a tutorial call carries the flag, so real incidents are unchanged
    this.server.to(`incidents`).emit('newIncident', {
      id: attemptId,
      deviceName,
      competitorName,
      ...(isTutorial && { isTutorial: true }),
    });
  }

  // Server-side only: a tutorial incident was resolved, deleted or expired
  // (SPEC-012); the open lists refetch as after an attempt edit
  handleIncidentsChanged() {
    this.server.to(`incidents`).emit('attemptUpdated');
  }

  // Server-side only: a group started while a station is still in tutorial
  // mode, or the room's first group of the day ended one (SPEC-012)
  handleTutorialNotice(notice: TutorialNotice) {
    this.server.to(`incidents`).emit('tutorialNotice', notice);
  }

  @SubscribeMessage('attemptUpdated')
  @UseGuards(DelegateGuard)
  handleAttemptUpdated() {
    this.handleStatisticsUpdated();
    this.server.to(`incidents`).emit('attemptUpdated');
  }

  /* ====================== */
  /* ==== Live Solving ==== */
  /* ====================== */
  @SubscribeMessage('joinLiveSolving')
  async handleJoinLiveSolving(@ConnectedSocket() socket: Socket) {
    socket.join('live-solving');
    socket.emit('currentStations', Array.from(this.stations.values()));
  }

  @SubscribeMessage('leaveLiveSolving')
  async handleLeaveLiveSolving(@ConnectedSocket() socket: Socket) {
    socket.leave('live-solving');
  }

  broadcastCurrentTimeInfo(info: Omit<StationInfo, 'lastSolve'>) {
    this.emitStation({
      ...info,
      lastSolve: this.lastSolves.get(info.espId) ?? null,
    });
  }

  recordLastSolve(espId: number, lastSolve: LastSolve) {
    this.lastSolves.set(espId, lastSolve);
    // A station not heard from yet picks it up with its first packet
    const station = this.stations.get(espId);
    if (station) this.emitStation({ ...station, lastSolve });
  }

  /** Drops a retired or deleted station from live solving */
  forgetStation(espId: number) {
    this.lastSolves.delete(espId);
    if (!this.stations.delete(espId)) return;
    this.server.to('live-solving').emit('stationRemoved', { espId });
  }

  /**
   * Takes a station off live solving while it times a tutorial solve, keeping
   * its last real solve for when it comes back (SPEC-012)
   */
  hideStation(espId: number) {
    if (!this.stations.delete(espId)) return;
    this.server.to('live-solving').emit('stationRemoved', { espId });
  }

  private emitStation(info: StationInfo) {
    this.stations.set(info.espId, info);
    this.server.to('live-solving').emit('currentTimeInfo', info);
  }
}
