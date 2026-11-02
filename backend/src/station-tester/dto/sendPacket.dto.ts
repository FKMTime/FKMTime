import { IsObject, IsString } from 'class-validator';

export class SendPacketDto {
  @IsString()
  type: string;

  // Left unvalidated: sending what a station should never send is the point
  @IsObject()
  data: Record<string, unknown>;
}
