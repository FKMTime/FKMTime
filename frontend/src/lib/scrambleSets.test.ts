import { describe, expect, it } from "vitest";

import { getLastSetNumber } from "./scrambleSets";

describe("getLastSetNumber", () => {
    it("is 0 for a round with no sets, so the first added set is A", () => {
        expect(getLastSetNumber([])).toBe(0);
    });

    it("is the highest set, whatever order the sets come in", () => {
        expect(
            getLastSetNumber([{ set: "A" }, { set: "C" }, { set: "B" }])
        ).toBe(3);
    });
});
