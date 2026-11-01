import {
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import * as net from 'net';

import { RequestDto } from '../socket/dto/request.dto';
import { SendPacketDto } from './dto/sendPacket.dto';

export interface StationReply {
  type: string;
  tag?: number;
  data: unknown;
  error?: boolean;
}

@Injectable()
export class StationTesterService {
  private readonly socketPath = process.env.SOCKET_PATH || '/tmp/socket.sock';
  replyTimeoutMs = 5000;

  /**
   * Sends a packet the way a station does, over the unix socket and on a
   * connection of its own, and resolves with the reply carrying its tag.
   */
  send({ type, data }: SendPacketDto) {
    const sent: RequestDto<unknown> = {
      type,
      tag: randomInt(1, 2 ** 31),
      data,
    };

    return new Promise<{ sent: RequestDto<unknown>; reply: StationReply }>(
      (resolve, reject) => {
        const connection = net.createConnection({ path: this.socketPath });
        let buffer = Buffer.alloc(0);

        const fail = (error: HttpException) => {
          clearTimeout(timeout);
          connection.destroy();
          reject(error);
        };
        const timeout = setTimeout(
          () => fail(new GatewayTimeoutException(`No reply to ${type}`)),
          this.replyTimeoutMs,
        );

        connection.on('data', (chunk) => {
          buffer = Buffer.concat([buffer, chunk]);
          let end = buffer.indexOf(0x00);
          while (end !== -1) {
            const reply = this.parseReply(buffer.subarray(0, end));
            buffer = buffer.subarray(end + 1);
            end = buffer.indexOf(0x00);
            // The server also sends broadcasts, like its status, down here
            if (reply?.tag === sent.tag) {
              clearTimeout(timeout);
              connection.end();
              resolve({ sent, reply });
              return;
            }
          }
        });
        connection.on('error', (error) =>
          fail(new BadGatewayException(error.message)),
        );
        connection.write(JSON.stringify(sent) + '\0');
      },
    );
  }

  private parseReply(packet: Buffer): StationReply | null {
    try {
      return JSON.parse(packet.toString());
    } catch {
      // Hardware-in-the-loop output isn't JSON
      return null;
    }
  }
}
