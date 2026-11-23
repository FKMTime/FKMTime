import { describe, expect, it } from "vitest";

import { delayAxisTicks } from "./delayAxisTicks";

describe("delayAxisTicks", () => {
    it("extends below zero when a round started early", () => {
        expect(delayAxisTicks([-5, 10])).toEqual([-5, 0, 5, 10]);
    });

    it("rounds both ends outwards to 5 minutes", () => {
        expect(delayAxisTicks([-7, 12])).toEqual([-10, -5, 0, 5, 10, 15]);
    });

    it("keeps zero on the axis when every round ran early", () => {
        expect(delayAxisTicks([-3, -12])).toEqual([-15, -10, -5, 0]);
    });

    it("starts at zero when no round ran early", () => {
        expect(delayAxisTicks([3, 8])).toEqual([0, 5, 10]);
    });

    it("reads delays sent as strings by the backend", () => {
        expect(delayAxisTicks(["-5.00", "10.00"])).toEqual([-5, 0, 5, 10]);
    });

    it("ignores rounds without a delay", () => {
        expect(delayAxisTicks([null, undefined])).toEqual([0]);
        expect(delayAxisTicks([null, 4])).toEqual([0, 5]);
    });
});
