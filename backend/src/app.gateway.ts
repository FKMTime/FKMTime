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
import { DeviceRequest } from './device/dto/requestToConnect.dto';

/** The last attempt a station entered, kept to show after it resets */
export interface LastSolve {
  personName: string;
  /** Centiseconds, before the penalty */
  value: number;
  /** Seconds added, as stored on attempts; -1 for DNF */
  penalty: number;
  enteredAt: number;
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
  ) {
    this.logger.log(
      `New incident on station ${deviceName} - ${competitorName}`,
    );
    this.server.to(`incidents`).emit('newIncident', {
      id: attemptId,
      deviceName,
      competitorName,
    });
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

  private emitStation(info: StationInfo) {
    this.stations.set(info.espId, info);
    this.server.to('live-solving').emit('currentTimeInfo', info);
  }
}
