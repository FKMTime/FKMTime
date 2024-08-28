import { describe } from "vitest";

import {
    calculateTotalPages,
    getCutoffByRoundId,
    getEventIdFromRoundId,
    getLimitByRoundId,
    getNumberOfAttemptsForRound,
    getPersonFromWcif,
    getRoundInfoFromWcif,
    prettyAvailableDeviceType,
    prettyDeviceType,
    prettyGender,
    prettyRoundFormat,
    prettyUserRoleName,
    regionNameByIso2,
} from "@/logic/utils.ts";

import wcif from "./wcif.json";

describe("calculateTotalPages", () => {
    it("calculates the total number of pages", () => {
        expect(calculateTotalPages(100, 10)).toEqual(10);
    });
    it("calculates the total number of pages with a remainder", () => {
        expect(calculateTotalPages(101, 10)).toEqual(11);
    });
});

describe("prettyGender", () => {
    it("return gender name", () => {
        expect(prettyGender("m")).toEqual("Male");
    });
    it("return other for unknown", () => {
        expect(prettyGender("unknown")).toEqual("Other");
    });
});

describe("regionNameByIso2", () => {
    it("return region name by iso2", () => {
        expect(regionNameByIso2("US")).toEqual("United States");
    });
});

describe("getPersonFromWcif", () => {
    it("return person from wcif", () => {
        const wcifJson = JSON.parse(JSON.stringify(wcif));
        expect(getPersonFromWcif(1, wcifJson)).toEqual(wcif.persons[0]);
    });
});

describe("getEventIdFromRoundId", () => {
    it("return event id from round id", () => {
        expect(getEventIdFromRoundId("333-r1")).toEqual("333");
    });
});

describe("getRoundInfoFromWcif", () => {
    it("return round info from wcif", () => {
        const wcifJson = JSON.parse(JSON.stringify(wcif));
        expect(getRoundInfoFromWcif("333-r1", wcifJson)).toEqual(
            wcif.events[0].rounds[0]
        );
    });
});

describe("getCutoffByRoundId", () => {
    it("return cutoff by round id", () => {
        const wcifJson = JSON.parse(JSON.stringify(wcif));
        expect(getCutoffByRoundId("333-r1", wcifJson)).toEqual(null);
    });
});

describe("getLimitByRoundId", () => {
    it("return limit by round id", () => {
        const wcifJson = JSON.parse(JSON.stringify(wcif));
        expect(getLimitByRoundId("333-r1", wcifJson)).toEqual({
            centiseconds: 60000,
            cumulativeRoundIds: [],
        });
    });
});

describe("getNumberOfAttemptsForRound", () => {
    it("return number of attempts for round if ao5", () => {
        const wcifJson = JSON.parse(JSON.stringify(wcif));
        expect(getNumberOfAttemptsForRound("333-r1", wcifJson)).toEqual(5);
    });
    it("return number of attempts for round if mo3", () => {
        const wcifJson = JSON.parse(JSON.stringify(wcif));
        expect(getNumberOfAttemptsForRound("666-r1", wcifJson)).toEqual(3);
    });
});

describe("prettyRoundFormat", () => {
    it("return pretty round format for ao5", () => {
        expect(prettyRoundFormat("a")).toEqual("Average of 5");
    });
    it("return pretty round format for ao5 with cutoff after 2 attempts", () => {
        expect(prettyRoundFormat("a", 2)).toEqual("Best of 2 / Average of 5");
    });
    it("return pretty round format for mo3", () => {
        expect(prettyRoundFormat("m")).toEqual("Mean of 3");
    });
    it("return pretty round format for bo1", () => {
        expect(prettyRoundFormat("1")).toEqual("Best of 1");
    });
    it("return pretty round format for bo2", () => {
        expect(prettyRoundFormat("2")).toEqual("Best of 2");
    });
    it("return pretty round format for unknown", () => {
        expect(prettyRoundFormat("unknown")).toEqual("Unknown");
    });
});

describe("prettyDeviceType", () => {
    it("return pretty device type", () => {
        expect(prettyDeviceType("STATION")).toEqual("Station");
    });
});

describe("prettyAvailableDeviceType", () => {
    it("return pretty available device type", () => {
        expect(prettyAvailableDeviceType("STAFF_ATTENDANCE")).toEqual(
            "Staff attendance device"
        );
    });
});

describe("prettyUserRoleName", () => {
    it("return pretty user role name", () => {
        expect(prettyUserRoleName("ADMIN")).toEqual("Admin");
    });
});
