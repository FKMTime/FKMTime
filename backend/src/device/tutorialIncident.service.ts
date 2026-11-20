import { forwardRef, HttpException, Inject, Injectable } from '@nestjs/common';
import { AttemptStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AppGateway } from 'src/app.gateway';

import { SocketController } from '../socket/socket.controller';

/** The station stops waiting for the delegate's answer after this long */
export const TUTORIAL_INCIDENT_TTL_MS = 5 * 60_000;

/** A delegate call made during a tutorial, kept in memory only (SPEC-012) */
export interface TutorialIncident {
  id: string;
  espId: number;
  deviceName: string;
  roomId: string;
  competitorName: string;
  judgeName: string | null;
  /** Centiseconds, as the station sent it */
  value: number;
  penalty: number;
  inspectionTime: number;
  sessionId: string;
  createdAt: string;
}

export type TutorialIncidentCall = Omit<TutorialIncident, 'id' | 'createdAt'>;

export interface ResolveTutorialIncident {
  value: number;
  penalty: number;
  status: AttemptStatus;
  doNotRequireCards?: boolean;
}

@Injectable()
export class TutorialIncidentService {
  private readonly incidents = new Map<string, TutorialIncident>();
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(
    @Inject(forwardRef(() => SocketController))
    private readonly socketController: SocketController,
    @Inject(forwardRef(() => AppGateway))
    private readonly appGateway: AppGateway,
  ) {}

  /** A resent call from the same station and session keeps its one entry */
  record(call: TutorialIncidentCall) {
    const existing = [...this.incidents.values()].find(
      (i) => i.espId === call.espId && i.sessionId === call.sessionId,
    );
    if (existing) return existing;
    const incident: TutorialIncident = {
      ...call,
      id: `tutorial-${randomUUID()}`,
      createdAt: new Date().toISOString(),
    };
    this.incidents.set(incident.id, incident);
    const timer = setTimeout(
      () => this.drop(incident.id),
      TUTORIAL_INCIDENT_TTL_MS,
    );
    timer.unref?.();
    this.timers.set(incident.id, timer);
    this.appGateway.handleNewIncident(
      incident.deviceName,
      incident.competitorName,
      incident.id,
      true,
    );
    return incident;
  }

  getAll() {
    return [...this.incidents.values()].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
  }

  count() {
    return this.incidents.size;
  }

  /**
   * Answers the waiting station as resolving a real incident would: a decided
   * time asks for the cards again unless the delegate says not to; an extra
   * ends the attempt
   */
  resolve(id: string, data: ResolveTutorialIncident) {
    const incident = this.getOrThrow(id);
    const isResolved = data.status === AttemptStatus.RESOLVED;
    this.answerStation(
      incident,
      isResolved && !data.doNotRequireCards,
      isResolved ? data : incident,
    );
    this.drop(id);
    return { message: 'Tutorial incident resolved' };
  }

  remove(id: string) {
    const incident = this.getOrThrow(id);
    this.answerStation(incident, false, incident);
    this.drop(id);
    return { message: 'Tutorial incident deleted' };
  }

  /** The station was deleted or retired */
  forgetStation(espId: number) {
    for (const incident of [...this.incidents.values()]) {
      if (incident.espId === espId) this.drop(incident.id);
    }
  }

  private getOrThrow(id: string) {
    const incident = this.incidents.get(id);
    if (!incident) {
      throw new HttpException(
        {
          message: 'The station stopped waiting for this tutorial incident',
        },
        404,
      );
    }
    return incident;
  }

  /** The connector needs the session id with the time and penalty */
  private answerStation(
    incident: TutorialIncident,
    shouldScanCards: boolean,
    result: { value: number; penalty: number },
  ) {
    this.socketController.sendResponseToAllSockets({
      type: 'IncidentResolved',
      data: {
        espId: incident.espId,
        shouldScanCards,
        attempt: {
          sessionId: incident.sessionId,
          value: result.value,
          penalty: result.penalty,
        },
      },
    });
  }

  private drop(id: string) {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    if (this.incidents.delete(id)) {
      this.appGateway.handleIncidentsChanged();
    }
  }
}
