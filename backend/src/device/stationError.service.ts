import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AppGateway } from 'src/app.gateway';

/** After this long without a newer reply, the error is no longer shown */
export const STATION_ERROR_TTL_MS = 10 * 60_000;
/** How often stations are checked for errors that expired */
const EXPIRY_CHECK_INTERVAL_MS = 5_000;

/**
 * Errors the delegate can fix. Every other key is the rules working as
 * intended: cutoff not passed, no attempts left, and the like (SPEC-010)
 */
const PROBLEM_KEYS = new Set([
  'competitionNotFound',
  'stationNotFound',
  'noGroups',
  'groupNotFound',
  'stationRoundChanged',
  'h2hRoundNotOnStations',
  'competitorNotFound',
  'judgeNotFound',
  'judgeIsCompetitor',
  'judgeCardNotScanned',
  'competitorIsNotSignedInForEvent',
  'internalError',
]);

export type StationErrorKind = 'problem' | 'rule';

/** What a service attaches to an error reply for a station; never sent to it */
export interface StationErrorDetails {
  key: string;
  /** The card the error is about, if any */
  cardId?: string | number | null;
  /** The competitor, when the backend knows who it was */
  competitorName?: string | null;
}

export interface StationLastError {
  key: string;
  kind: StationErrorKind;
  /** The text the station showed, in its language */
  message: string;
  /** When it last happened */
  at: string;
  /** How many times in a row this key happened */
  count: number;
  cardId: string | null;
  competitorName: string | null;
}

export interface DeviceErrorEvent {
  espId: number;
  lastError: StationLastError | null;
}

/** A reply to a station, as the services build it */
interface StationReply {
  error?: boolean;
  message?: string;
  shouldResetTime?: boolean;
  errorDetails?: StationErrorDetails;
}

/**
 * Each station's last error, kept in memory only, so the Devices page can say
 * what went wrong and how to fix it (SPEC-010)
 */
@Injectable()
export class StationErrorService implements OnModuleInit, OnModuleDestroy {
  private errors = new Map<number, StationLastError>();
  private expiryCheck: NodeJS.Timeout | null = null;

  constructor(private readonly appGateway: AppGateway) {}

  onModuleInit() {
    this.expiryCheck = setInterval(
      () => this.dropExpired(),
      EXPIRY_CHECK_INTERVAL_MS,
    );
    this.expiryCheck.unref?.();
  }

  onModuleDestroy() {
    if (this.expiryCheck) clearInterval(this.expiryCheck);
    this.expiryCheck = null;
  }

  /**
   * Records an error reply, or clears the station's error on a successful
   * one, and returns the reply without the details meant for the panel
   */
  handleReply<T extends StationReply>(
    espId: number | undefined,
    reply: T,
  ): Omit<T, 'errorDetails'> {
    if (!reply || typeof reply !== 'object') return reply;
    const { errorDetails, ...forStation } = reply;
    if (typeof espId !== 'number') return forStation;
    // A resent solve that is already saved, unchanged: nothing went wrong
    const savedResend =
      errorDetails?.key === 'attemptAlreadyEntered' && reply.shouldResetTime;
    if (!reply.error || savedResend) {
      this.clear(espId);
    } else if (errorDetails) {
      this.record(espId, errorDetails, reply.message ?? errorDetails.key);
    }
    return forStation;
  }

  record(espId: number, details: StationErrorDetails, message: string) {
    const previous = this.getLastError(espId);
    const lastError: StationLastError = {
      key: details.key,
      kind: PROBLEM_KEYS.has(details.key) ? 'problem' : 'rule',
      message,
      at: new Date().toISOString(),
      count: previous?.key === details.key ? previous.count + 1 : 1,
      cardId: details.cardId != null ? String(details.cardId) : null,
      competitorName: details.competitorName ?? null,
    };
    this.errors.set(espId, lastError);
    this.appGateway.handleDeviceError({ espId, lastError });
  }

  clear(espId: number) {
    if (!this.errors.delete(espId)) return;
    this.appGateway.handleDeviceError({ espId, lastError: null });
  }

  /** A deleted station: nobody is looking at it any more */
  forget(espId: number) {
    this.errors.delete(espId);
  }

  getLastError(espId: number): StationLastError | null {
    const lastError = this.errors.get(espId);
    if (!lastError || isExpired(lastError)) return null;
    return lastError;
  }

  /** Errors expire without a reply to say so */
  dropExpired() {
    for (const [espId, lastError] of this.errors) {
      if (isExpired(lastError)) this.clear(espId);
    }
  }
}

const isExpired = (lastError: StationLastError) =>
  Date.now() - Date.parse(lastError.at) >= STATION_ERROR_TTL_MS;
