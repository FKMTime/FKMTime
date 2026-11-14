export interface CurrentTimeInfoDto {
  espId: number;
  time?: number;
  inspection?: number;
  competitor?: number;
  groupId?: string;
  /** Whether the solve timer is running; absent from older firmware */
  timerRunning?: boolean | null;
  /** Whether inspection is running; absent from older firmware */
  inspectionRunning?: boolean | null;
  /** The station's Wi-Fi RSSI in dBm; absent or null when unknown (SPEC-008) */
  rssi?: number | null;
}
