import { describe, expect, it } from "vitest";
import { z } from "zod";

import { deviceSchema } from "../schema/deviceSchema";
import { limitedText, requiredText } from "../schema/fields";
import { manualIncidentSchema } from "../schema/manualIncidentSchema";
import { noteworthyIncidentSchema } from "../schema/noteworthyIncidentSchema";
import { addPersonSchema } from "../schema/personSchema";
import { quickActionSchema } from "../schema/quickActionsSchema";
import { scramblingDeviceSchema } from "../schema/scramblingDeviceSchema";
import { changePasswordSchema } from "../schema/settingsSchema";
import {
    createFKMTimeUserSchema,
    createWCAUserSchema,
    editUserPasswordSchema,
} from "../schema/userSchema";
import { warningSchema } from "../schema/warningSchema";

const messages = (schema: z.ZodType, values: unknown) =>
    schema.safeParse(values).error?.issues.map((issue) => issue.message) ?? [];

const zodDefaultText = /invalid (input|option)|too (small|big)|expected/i;

describe("form schemas", () => {
    it.each([
        ["device", deviceSchema, {}],
        ["manual incident", manualIncidentSchema, {}],
        ["noteworthy incident", noteworthyIncidentSchema, {}],
        ["person", addPersonSchema, {}],
        // Checkboxes always have a value
        [
            "quick action",
            quickActionSchema,
            { giveExtra: false, isShared: false },
        ],
        ["scrambling device", scramblingDeviceSchema, {}],
        ["change password", changePasswordSchema, {}],
        ["FKMTime account", createFKMTimeUserSchema, {}],
        ["WCA user", createWCAUserSchema, {}],
        ["user password", editUserPasswordSchema, {}],
        ["warning", warningSchema, {}],
    ])("explains every field missing from the %s form", (_, schema, values) => {
        const found = messages(schema, values);
        expect(found.length).toBeGreaterThan(0);
        expect(found.filter((text) => zodDefaultText.test(text))).toEqual([]);
    });

    it("refuses a blank FKMTime account", () => {
        expect(messages(createFKMTimeUserSchema, {})).toEqual([
            "Username is required",
            "Full name is required",
            "Password is required",
        ]);
    });

    it("asks for a person on a WCA user", () => {
        expect(messages(createWCAUserSchema, {})).toEqual([
            "Please select a person",
        ]);
    });

    it("asks for a room on a scrambling device left on the empty choice", () => {
        expect(
            messages(scramblingDeviceSchema, { name: "Tablet", roomId: "" })
        ).toEqual(["Please select a room"]);
    });

    it("explains an ESP ID that is not hexadecimal", () => {
        expect(
            messages(deviceSchema, {
                name: "Station",
                espId: "XYZ",
                roomId: "room-a",
                type: "STATION",
                hwVersion: "V3",
            })
        ).toEqual(["ESP ID can only use digits 0-9 and letters A-F"]);
    });
});

describe("requiredText", () => {
    const field = requiredText("Title is required");

    it("uses the same message for a missing and an empty value", () => {
        expect(messages(field, undefined)).toEqual(["Title is required"]);
        expect(messages(field, "")).toEqual(["Title is required"]);
    });
});

describe("limitedText", () => {
    const field = limitedText("Name", 2, 5);

    it("names the field and the limit it broke", () => {
        expect(messages(field, undefined)).toEqual(["Name is required"]);
        expect(messages(field, "a")).toEqual([
            "Name must be at least 2 characters",
        ]);
        expect(messages(field, "abcdef")).toEqual([
            "Name can be at most 5 characters",
        ]);
    });

    it("accepts text at both limits", () => {
        expect(messages(field, "ab")).toEqual([]);
        expect(messages(field, "abcde")).toEqual([]);
    });
});
