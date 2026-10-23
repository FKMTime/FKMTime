import { INestApplication } from '@nestjs/common';
import {
  DeviceType,
  HardwareVersion,
  Person,
  Role,
  SendingResultsFrequency,
} from '@prisma/client';
import { sha512 } from 'js-sha512';
import { DbService } from 'src/db/db.service';

import { loginWithFKMAccount } from './auth.helper';

/**
 * Builds the world a physical station needs (rooms with current groups,
 * registered devices, persons with RFID cards) and puts everything back
 * afterwards, so specs stay independent on the shared CI database.
 *
 * Every spec passes its own prefix and its own espId / card number range.
 */
export class StationFixtures {
  private startedAt = new Date();
  private roomIds: string[] = [];
  private deviceIds: string[] = [];
  private userIds: string[] = [];
  private originalCards = new Map<string, string | null>();
  private staffSnapshot: {
    id: string;
    status: any;
    deviceId: string | null;
  }[] = [];
  private originalFrequency: SendingResultsFrequency | null = null;

  constructor(
    private readonly db: DbService,
    private readonly prefix: string,
  ) {}

  /**
   * Removes whatever an aborted earlier run of the same spec left behind
   * (rows carrying the prefix, persons still holding this spec's cards).
   */
  async purgeLeftovers(cardIds: number[]) {
    const devices = await this.db.device.findMany({
      where: { name: { startsWith: `${this.prefix}-` } },
    });
    const deviceIds = devices.map((d) => d.id);
    await this.db.attempt.deleteMany({
      where: { deviceId: { in: deviceIds } },
    });
    await this.db.staffActivity.updateMany({
      where: { deviceId: { in: deviceIds } },
      data: { deviceId: null },
    });
    await this.db.device.deleteMany({ where: { id: { in: deviceIds } } });
    await this.db.room.deleteMany({
      where: { name: { startsWith: `${this.prefix}-` } },
    });
    await this.db.user.deleteMany({
      where: { username: { startsWith: `${this.prefix}-` } },
    });
    await this.db.person.updateMany({
      where: { cardId: { in: cardIds.map((c) => c.toString()) } },
      data: { cardId: null },
    });
  }

  /** Results are not pushed to WCA Live while the spec runs */
  async disableResultSubmission() {
    const competition = await this.db.competition.findFirst();
    this.originalFrequency = competition.sendingResultsFrequency;
    await this.db.competition.update({
      where: { id: competition.id },
      data: { sendingResultsFrequency: SendingResultsFrequency.NEVER },
    });
  }

  async createRoom(suffix: string, currentGroupIds: string[]) {
    const room = await this.db.room.create({
      data: {
        name: `${this.prefix}-${suffix}`,
        color: '#123456',
        currentGroupIds,
      },
    });
    this.roomIds.push(room.id);
    return room;
  }

  async createDevice(
    suffix: string,
    espId: number,
    roomId: string,
    type: DeviceType = DeviceType.STATION,
    hwVersion: HardwareVersion = HardwareVersion.V4,
  ) {
    const device = await this.db.device.create({
      data: {
        name: `${this.prefix}-${suffix}`,
        espId,
        signKey: espId,
        type,
        hwVersion,
        room: { connect: { id: roomId } },
      },
    });
    this.deviceIds.push(device.id);
    return device;
  }

  /** Gives a seeded person (by registrant id) an RFID card number */
  async giveCard(registrantId: number, cardId: number): Promise<Person> {
    const person = await this.db.person.findFirst({ where: { registrantId } });
    if (!this.originalCards.has(person.id)) {
      this.originalCards.set(person.id, person.cardId);
      const activities = await this.db.staffActivity.findMany({
        where: { personId: person.id },
      });
      this.staffSnapshot.push(
        ...activities.map((a) => ({
          id: a.id,
          status: a.status,
          deviceId: a.deviceId,
        })),
      );
    }
    return this.db.person.update({
      where: { id: person.id },
      data: { cardId: cardId.toString() },
    });
  }

  async createUserToken(app: INestApplication, suffix: string, roles: Role[]) {
    const username = `${this.prefix}-${suffix}`;
    const password = `${username}-password`;
    const user = await this.db.user.create({
      data: { username, fullName: username, roles, password: sha512(password) },
    });
    this.userIds.push(user.id);
    const { token } = await loginWithFKMAccount(app, { username, password });
    return token;
  }

  get personIds() {
    return [...this.originalCards.keys()];
  }

  async cleanup() {
    const personIds = this.personIds;
    // Attempts entered during the spec (from stations or by hand) and the
    // results that only exist because of them
    await this.db.attempt.deleteMany({
      where: {
        OR: [
          { deviceId: { in: this.deviceIds } },
          {
            result: { personId: { in: personIds } },
            createdAt: { gte: this.startedAt },
          },
        ],
      },
    });
    await this.db.result.deleteMany({
      where: {
        personId: { in: personIds },
        createdAt: { gte: this.startedAt },
      },
    });
    // Attendance: drop rows created during the spec, restore seeded ones
    const snapshotIds = this.staffSnapshot.map((s) => s.id);
    await this.db.staffActivity.deleteMany({
      where: {
        OR: [
          { personId: { in: personIds }, id: { notIn: snapshotIds } },
          { deviceId: { in: this.deviceIds }, id: { notIn: snapshotIds } },
        ],
      },
    });
    for (const s of this.staffSnapshot) {
      await this.db.staffActivity.update({
        where: { id: s.id },
        data: { status: s.status, deviceId: s.deviceId },
      });
    }
    for (const [id, cardId] of this.originalCards) {
      await this.db.person.update({ where: { id }, data: { cardId } });
    }
    await this.db.device.deleteMany({ where: { id: { in: this.deviceIds } } });
    // Devices created over HTTP during the spec use the same name prefix
    await this.db.device.deleteMany({
      where: { name: { startsWith: `${this.prefix}-` } },
    });
    await this.db.room.deleteMany({ where: { id: { in: this.roomIds } } });
    await this.db.user.deleteMany({ where: { id: { in: this.userIds } } });
    if (this.originalFrequency) {
      await this.db.competition.updateMany({
        data: { sendingResultsFrequency: this.originalFrequency },
      });
    }
  }
}
