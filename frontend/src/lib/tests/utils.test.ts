import { describe } from "vitest";

import {
    calculateTotalPages,
    prettyAvailableDeviceType,
    prettyDeviceType,
    prettyGender,
    prettyUserRoleName,
    regionNameByIso2,
} from "@/lib/utils.ts";

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
