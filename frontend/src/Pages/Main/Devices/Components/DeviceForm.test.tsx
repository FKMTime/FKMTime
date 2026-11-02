import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
    DeviceData,
    DeviceType,
    HardwareVersion,
    Room,
} from "@/lib/interfaces";

import DeviceForm from "./DeviceForm";

const rooms = [
    { id: "room-a", name: "Room A" },
    { id: "room-b", name: "Room B" },
] as Room[];

const defaultValues: DeviceData = {
    name: "",
    espId: 0,
    roomId: "",
    type: DeviceType.STATION,
    hwVersion: HardwareVersion.V3,
};

const renderForm = (handleSubmit = vi.fn()) => {
    render(
        <DeviceForm
            defaultValues={defaultValues}
            handleSubmit={handleSubmit}
            rooms={rooms}
            availableTypes={[DeviceType.STATION]}
            availableHwVersions={[HardwareVersion.V3]}
            submitText="Add"
            isLoading={false}
        />
    );
    return handleSubmit;
};

describe("DeviceForm", () => {
    it("asks for a room instead of submitting without one", async () => {
        const handleSubmit = renderForm();

        await userEvent.type(screen.getByPlaceholderText("Name"), "Station 1");
        await userEvent.click(screen.getByRole("button", { name: "Add" }));

        expect(await screen.findByText("Please select a room")).toBeTruthy();
        expect(handleSubmit).not.toHaveBeenCalled();
    });
});
