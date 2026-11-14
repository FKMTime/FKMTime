import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AppGateway } from 'src/app.gateway';

/** How many of the latest readings the level is the median of */
export const SIGNAL_WINDOW = 5;
/** A median at or below this is weak (dBm) */
export const WEAK_AT_OR_BELOW_DBM = -63;
/** A weak station is ok again only once its median is above this (dBm) */
export const OK_AGAIN_ABOVE_DBM = -59;
/** Without a reading for this long, the level is unknown and the link gone */
export const SIGNAL_STALE_MS = 30_000;
/** deviceSignal goes out at most this often per station without a level change */
export const SIGNAL_EMIT_INTERVAL_MS = 10_000;
/** How often stations are checked for readings that went stale */
const STALE_CHECK_INTERVAL_MS = 5_000;

export type SignalLevel = 'ok' | 'weak' | 'unknown';

/** What the access point reports about a station (SPEC-008) */
export interface StationLinkInfo {
  apSignal: number | null;
  txBitrateKbps: number | null;
  txRetriesPercent: number | null;
}

export interface StationLinkDto extends StationLinkInfo {
  espId: number;
}

export interface StationSignal {
  level: SignalLevel;
  /** Median of the readings that decide the level, in dBm */
  rssi: number | null;
  link: StationLinkInfo | null;
  /** Whether the station has sent its own RSSI since the backend started */
  reportedRssi: boolean;
}

export interface DeviceSignalEvent extends StationSignal {
  espId: number;
}

/** The last readings from one source, with the level they decided */
interface Readings {
  values: number[];
  lastAt: number;
  level: 'ok' | 'weak';
}

interface StationState {
  own: Readings | null;
  ap: Readings | null;
  link: { info: StationLinkInfo; at: number } | null;
  emitted: { level: SignalLevel; hasLink: boolean; at: number } | null;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** A real RSSI is negative; 0 and anything else means no reading */
const isReading = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value < 0;

const numberOrNull = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/**
 * Each station's Wi-Fi signal, kept in memory only: it changes every few
 * seconds and means nothing after a restart (SPEC-008)
 */
@Injectable()
export class StationSignalService implements OnModuleInit, OnModuleDestroy {
  private stations = new Map<number, StationState>();
  private staleCheck: NodeJS.Timeout | null = null;

  constructor(private readonly appGateway: AppGateway) {}

  onModuleInit() {
    this.staleCheck = setInterval(
      () => this.emitStaleChanges(),
      STALE_CHECK_INTERVAL_MS,
    );
    this.staleCheck.unref?.();
  }

  onModuleDestroy() {
    if (this.staleCheck) clearInterval(this.staleCheck);
    this.staleCheck = null;
  }

  /** The station's own RSSI, from CurrentTimeInfo */
  recordRssi(espId: number, rssi: unknown) {
    if (!isReading(rssi)) return;
    const state = this.state(espId);
    state.own = this.addReading(state.own, rssi);
    this.emitIfDue(espId, state);
  }

  /** The access point's view of the station, from StationLink */
  recordLink(data: StationLinkDto) {
    if (typeof data?.espId !== 'number') return;
    const state = this.state(data.espId);
    const apSignal = numberOrNull(data.apSignal);
    state.link = {
      info: {
        apSignal,
        txBitrateKbps: numberOrNull(data.txBitrateKbps),
        txRetriesPercent: numberOrNull(data.txRetriesPercent),
      },
      at: Date.now(),
    };
    if (isReading(apSignal)) {
      state.ap = this.addReading(state.ap, apSignal);
    }
    this.emitIfDue(data.espId, state);
  }

  getSignal(espId: number): StationSignal {
    const state = this.stations.get(espId);
    if (!state) {
      return { level: 'unknown', rssi: null, link: null, reportedRssi: false };
    }
    const now = Date.now();
    const fresh = (readings: Readings | null) =>
      readings && now - readings.lastAt < SIGNAL_STALE_MS ? readings : null;
    // The station's own reading when it has one; the access point's for a
    // station on older firmware
    const deciding = fresh(state.own) ?? fresh(state.ap);
    const link =
      state.link && now - state.link.at < SIGNAL_STALE_MS
        ? state.link.info
        : null;
    return {
      level: deciding?.level ?? 'unknown',
      rssi: deciding ? Math.round(median(deciding.values)) : null,
      link,
      reportedRssi: state.own !== null,
    };
  }

  private state(espId: number) {
    let state = this.stations.get(espId);
    if (!state) {
      state = { own: null, ap: null, link: null, emitted: null };
      this.stations.set(espId, state);
    }
    return state;
  }

  private addReading(previous: Readings | null, value: number): Readings {
    const now = Date.now();
    // Readings from before a gap say nothing about where the station is now
    const isStale = !previous || now - previous.lastAt >= SIGNAL_STALE_MS;
    const values = [...(isStale ? [] : previous.values), value].slice(
      -SIGNAL_WINDOW,
    );
    const middle = median(values);
    // Hysteresis: a station near the threshold doesn't flicker
    const wasWeak = !isStale && previous.level === 'weak';
    const level = wasWeak
      ? middle > OK_AGAIN_ABOVE_DBM
        ? 'ok'
        : 'weak'
      : middle <= WEAK_AT_OR_BELOW_DBM
        ? 'weak'
        : 'ok';
    return { values, lastAt: now, level };
  }

  /** On a level change straight away, otherwise at most every 10 s */
  private emitIfDue(espId: number, state: StationState) {
    const signal = this.getSignal(espId);
    const due =
      !state.emitted ||
      state.emitted.level !== signal.level ||
      state.emitted.hasLink !== (signal.link !== null) ||
      Date.now() - state.emitted.at >= SIGNAL_EMIT_INTERVAL_MS;
    if (due) this.emit(espId, state, signal);
  }

  /** Stations that stopped reporting go unknown without a packet to say so */
  emitStaleChanges() {
    for (const [espId, state] of this.stations) {
      if (!state.emitted) continue;
      const signal = this.getSignal(espId);
      if (
        state.emitted.level !== signal.level ||
        state.emitted.hasLink !== (signal.link !== null)
      ) {
        this.emit(espId, state, signal);
      }
    }
  }

  private emit(espId: number, state: StationState, signal: StationSignal) {
    state.emitted = {
      level: signal.level,
      hasLink: signal.link !== null,
      at: Date.now(),
    };
    this.appGateway.handleDeviceSignal({ espId, ...signal });
  }
}
