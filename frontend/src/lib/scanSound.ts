import { useState } from "react";

const STORAGE_KEY = "fkmtime-scan-sound";

/** Off unless turned on on this device */
export const isScanSoundEnabled = () =>
    localStorage.getItem(STORAGE_KEY) === "true";

export const setScanSoundEnabled = (enabled: boolean) =>
    localStorage.setItem(STORAGE_KEY, String(enabled));

/** The setting as React state, saved per device */
export const useScanSoundSetting = () => {
    const [enabled, setEnabled] = useState(isScanSoundEnabled);
    const update = (value: boolean) => {
        setScanSoundEnabled(value);
        setEnabled(value);
        if (value) playScanSound("success");
    };
    return [enabled, update] as const;
};

let audioContext: AudioContext | null = null;

const beep = (context: AudioContext, frequency: number, start: number) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.15, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.12);
};

/**
 * A short high beep for a good scan, two low beeps for a failed one. Does
 * nothing unless scan sounds are on for this device.
 */
export const playScanSound = (kind: "success" | "error") => {
    if (!isScanSoundEnabled() || typeof AudioContext === "undefined") return;
    audioContext ??= new AudioContext();
    const now = audioContext.currentTime;
    if (kind === "success") {
        beep(audioContext, 1046, now);
    } else {
        beep(audioContext, 220, now);
        beep(audioContext, 220, now + 0.18);
    }
};
