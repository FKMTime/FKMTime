import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Server, Socket } from 'socket.io';
import { RequestToConnectDto } from './device/dto/requestToConnect.dto';
import { AdminGuard } from './auth/guards/admin.guard';

@WebSocketGateway({
  namespace: '/',
  transports: ['websocket'],
  cors: {
    origin: '*',
  },
})
@UseGuards(AuthGuard('jwt'))
export class AppGateway {
  @WebSocketServer() server: Server;
  deviceRequests: RequestToConnectDto[] = [];
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

  @SubscribeMessage('resultEntered')
  handleResultEntered(roundId: string) {
    this.handleStatisticsUpdated();
    this.server.to(`results-${roundId}`).emit('resultEntered');
  }

  @SubscribeMessage('groupShouldBeChanged')
  handleGroupShouldBeChanged(message: string) {
    this.logger.log(`Group should be changed: ${message}`);
    this.server.to(`competition`).emit('groupShouldBeChanged', { message });
  }

  /* ====================== */
  /* ======= Devices ====== */
  /* ====================== */
  @SubscribeMessage('joinDevices')
  @UseGuards(AdminGuard)
  async handleJoinDevices(@ConnectedSocket() socket: Socket) {
    socket.join(`device`);
    this.sendDeviceRequests(socket);
  }

  @SubscribeMessage('leaveDevices')
  @UseGuards(AdminGuard)
  async handleLeaveDevices(@ConnectedSocket() socket: Socket) {
    socket.leave(`device`);
  }

  @SubscribeMessage('deviceUpdated')
  @UseGuards(AdminGuard)
  handleDeviceUpdated() {
    this.server.to(`device`).emit('deviceUpdated');
  }

  @SubscribeMessage('deviceRequests')
  @UseGuards(AdminGuard)
  sendDeviceRequests(@ConnectedSocket() socket: Socket) {
    socket.emit('deviceRequests', this.deviceRequests);
  }

  @UseGuards(AdminGuard)
  handleDeviceRequest(device: RequestToConnectDto) {
    if (this.deviceRequests.some((req) => req.espId === device.espId)) return;
    this.deviceRequests.push(device);
    this.server.to(`device`).emit('deviceRequests', this.deviceRequests);
  }

  @SubscribeMessage('removeDeviceRequest')
  @UseGuards(AdminGuard)
  handleRemoveDeviceRequest(@MessageBody() data: { espId: number }) {
    this.deviceRequests = this.deviceRequests.filter(
      (device) => device.espId !== data.espId,
    );
    this.server.to(`device`).emit('deviceRequests', this.deviceRequests);
  }

  @UseGuards(AdminGuard)
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
  @UseGuards(AdminGuard)
  async handleJoinCompetition(@ConnectedSocket() socket: Socket) {
    socket.join(`competition`);
  }

  @SubscribeMessage('leaveCompetition')
  @UseGuards(AdminGuard)
  async handleLeaveCompetition(@ConnectedSocket() socket: Socket) {
    socket.leave(`competition`);
  }

  /* ====================== */
  /* ==== Statistics ===== */
  /* ====================== */
  @SubscribeMessage('joinStatistics')
  @UseGuards(AdminGuard)
  async handleJoinStatistics(@ConnectedSocket() socket: Socket) {
    socket.join(`statistics`);
  }

  @SubscribeMessage('leaveStatistics')
  @UseGuards(AdminGuard)
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
  @UseGuards(AdminGuard)
  async handleJoinAttendance(
    @ConnectedSocket() socket: Socket,
    @MessageBody('groupId') groupId: string,
  ) {
    socket.join(`attendance-${groupId}`);
  }

  @SubscribeMessage('leaveAttendance')
  @UseGuards(AdminGuard)
  async handleLeaveAttentance(
    @ConnectedSocket() socket: Socket,
    @MessageBody('groupId') groupId: string,
  ) {
    socket.leave(`attendance-${groupId}`);
  }

  @UseGuards(AdminGuard)
  handleNewAttendance(groupId: string, competitorId: string) {
    this.server.to(`attendance-${groupId}`).emit('newAttendance', {
      competitorId,
    });
  }

  /* ====================== */
  /* ====== Incidents ===== */
  /* ====================== */
  @SubscribeMessage('joinIncidents')
  @UseGuards(AdminGuard)
  async handleJoinIncidents(@ConnectedSocket() socket: Socket) {
    socket.join(`incidents`);
  }

  @SubscribeMessage('leaveIncidents')
  @UseGuards(AdminGuard)
  async handleLeaveIncidents(@ConnectedSocket() socket: Socket) {
    socket.leave(`incidents`);
  }

  @SubscribeMessage('newIncident')
  @UseGuards(AdminGuard)
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
  @UseGuards(AdminGuard)
  handleAttemptUpdated() {
    this.handleStatisticsUpdated();
    this.server.to(`incidents`).emit('attemptUpdated');
  }
}
