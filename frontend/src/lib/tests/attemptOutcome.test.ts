import { describe, expect, it } from "vitest";

import { outcomeFromStatus, statusFromOutcome } from "@/lib/attemptOutcome";
import { AttemptStatus } from "@/lib/interfaces";

describe("attempt outcome", () => {
    it("reads stored statuses as plain outcomes", () => {
        expect(outcomeFromStatus(AttemptStatus.STANDARD)).toBe("counts");
        expect(outcomeFromStatus(AttemptStatus.RESOLVED)).toBe("counts");
        expect(outcomeFromStatus(AttemptStatus.EXTRA_GIVEN)).toBe("extra");
        expect(outcomeFromStatus(AttemptStatus.UNRESOLVED)).toBe("open");
        expect(outcomeFromStatus(AttemptStatus.SCRAMBLED)).toBe("scrambled");
        expect(outcomeFromStatus(AttemptStatus.VOIDED)).toBe("voided");
    });

    it("stores a new counted attempt as standard", () => {
        expect(statusFromOutcome("counts")).toBe(AttemptStatus.STANDARD);
        expect(statusFromOutcome("counts", AttemptStatus.STANDARD)).toBe(
            AttemptStatus.STANDARD
        );
    });

    it("marks a former incident that now counts as resolved", () => {
        expect(statusFromOutcome("counts", AttemptStatus.UNRESOLVED)).toBe(
            AttemptStatus.RESOLVED
        );
        expect(statusFromOutcome("counts", AttemptStatus.RESOLVED)).toBe(
            AttemptStatus.RESOLVED
        );
    });

    it("maps the other outcomes directly", () => {
        expect(statusFromOutcome("extra")).toBe(AttemptStatus.EXTRA_GIVEN);
        expect(statusFromOutcome("open")).toBe(AttemptStatus.UNRESOLVED);
        expect(statusFromOutcome("scrambled")).toBe(AttemptStatus.SCRAMBLED);
    });

    it("keeps a voided attempt voided", () => {
        expect(statusFromOutcome("voided")).toBe(AttemptStatus.VOIDED);
    });
});
