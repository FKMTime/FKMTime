import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const started: number[] = [];

class FakeAudioContext {
    currentTime = 0;
    destination = {};
    createOscillator() {
        return {
            frequency: { value: 0 },
            connect: (node: unknown) => node,
            start: (at: number) => started.push(at),
            stop: vi.fn(),
        };
    }
    createGain() {
        return {
            gain: {
                setValueAtTime: vi.fn(),
                exponentialRampToValueAtTime: vi.fn(),
            },
            connect: (node: unknown) => node,
        };
    }
}

describe("scan sounds", () => {
    beforeEach(() => {
        vi.resetModules();
        started.length = 0;
        localStorage.clear();
        vi.stubGlobal("AudioContext", FakeAudioContext);
    });
    afterEach(() => vi.unstubAllGlobals());

    it("is off by default and stays silent", async () => {
        const { isScanSoundEnabled, playScanSound } = await import(
            "@/lib/scanSound"
        );
        expect(isScanSoundEnabled()).toBe(false);
        playScanSound("success");
        expect(started).toEqual([]);
    });

    it("beeps once for a good scan and twice for a problem when on", async () => {
        const { playScanSound, setScanSoundEnabled } = await import(
            "@/lib/scanSound"
        );
        setScanSoundEnabled(true);
        playScanSound("success");
        expect(started).toHaveLength(1);
        playScanSound("error");
        expect(started).toHaveLength(3);
    });
});
