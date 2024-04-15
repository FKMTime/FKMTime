import { average, best } from "@/logic/average.ts";

import attempts from "./attempts.json";

describe("average", () => {
    it("calculates the ao5", () => {
        const parsedAttempt = JSON.parse(JSON.stringify(attempts)).attempts;
        expect(average(parsedAttempt)).toEqual(959);
    });
});

describe("best", () => {
    it("return best attempt", () => {
        const parsedAttempt = JSON.parse(JSON.stringify(attempts)).attempts;
        expect(best(parsedAttempt)).toEqual(171);
    });
});
