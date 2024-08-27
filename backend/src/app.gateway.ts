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
    private logger = new Logger(`AppGateway`);

    @SubscribeMessage('join')
    async handleJoin(
        @ConnectedSocket() socket: Socket,
        @MessageBody('roundId') roundId: string,
    ) {
        console.log("JOINdsadsadsadsads");
        socket.join(`results-${roundId}`);
    }

    @SubscribeMessage('leave')
    async handleLeave(
        @ConnectedSocket() socket: Socket,
        @MessageBody('roundId') roundId: string,
    ) {
        console.log("LEAVEdsadsadsadsads");
        socket.leave(`results-${roundId}`);
    }

    @SubscribeMessage('resultEntered')
    handleResultEntered(roundId: string) {
        this.server.to(`results-${roundId}`).emit('resultEntered');
    }

    @SubscribeMessage('groupShouldBeChanged')
    handleGroupShouldBeChanged(message: string) {
        this.logger.log(`Group should be changed: ${message}`);
        this.server.to(`competition`).emit('groupShouldBeChanged', { message });
    }
}
