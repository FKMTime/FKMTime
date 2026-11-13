import { afterEach, describe, expect, it } from "vitest";

import { getSubmissionPlatformName } from "./utils";

describe("getSubmissionPlatformName", () => {
    it("names WCA Live when official results go there", () => {
        expect(getSubmissionPlatformName("333", "WCA_LIVE")).toBe("WCA Live");
    });

    it.each(["WCA_INTEGRATED_LIVE", "NONE", undefined] as const)(
        "names nothing for official events when the destination is %s",
        (destination) => {
            expect(getSubmissionPlatformName("333", destination)).toBeNull();
        }
    );

    afterEach(() => localStorage.clear());

    it("names Cubing Contests for unofficial events whatever the destination", () => {
        // The panel keeps the events list, with the unofficial flag, here
        localStorage.setItem(
            "fkmtime-events",
            JSON.stringify([{ id: "mirror", isUnofficial: true }])
        );
        expect(getSubmissionPlatformName("mirror", "NONE")).toBe(
            "Cubing Contests"
        );
    });
});
