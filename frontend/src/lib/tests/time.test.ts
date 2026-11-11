import { describe, expect, it } from "vitest";

import { getIncidentInfoText } from "@/lib/incidents";
import { Incident } from "@/lib/interfaces";
import { formatElapsed } from "@/lib/time";

describe("formatElapsed", () => {
    const now = new Date("2026-04-18T12:00:00Z");

    it("rounds down to whole minutes", () => {
        expect(formatElapsed("2026-04-18T11:59:30Z", now)).toBe("now");
        expect(formatElapsed("2026-04-18T11:57:10Z", now)).toBe("2 min");
    });

    it("switches to hours after an hour", () => {
        expect(formatElapsed("2026-04-18T10:00:00Z", now)).toBe("2 h");
        expect(formatElapsed("2026-04-18T09:45:00Z", now)).toBe("2 h 15 min");
    });
});

describe("getIncidentInfoText", () => {
    it("names the competitor, WCA ID, round and attempt", () => {
        localStorage.setItem(
            "fkmtime-events",
            JSON.stringify([
                { id: "333", name: "3x3x3 Cube", shortName: "3x3" },
            ])
        );
        const incident = {
            attemptNumber: 2,
            result: {
                roundId: "333-r1",
                person: { name: "Anna Example", wcaId: "2019EXAM01" },
            },
        } as unknown as Incident;
        expect(getIncidentInfoText(incident)).toBe(
            "Anna Example (2019EXAM01), 3x3 R1A2"
        );
        incident.result.person.wcaId = undefined;
        expect(getIncidentInfoText(incident)).toBe("Anna Example, 3x3 R1A2");
    });
});
