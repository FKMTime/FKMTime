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

const renderForm = (handleSubmit = vi.fn(), formRooms = rooms) => {
    render(
        <DeviceForm
            defaultValues={defaultValues}
            handleSubmit={handleSubmit}
            rooms={formRooms}
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

    it("picks a room with one click on its button", async () => {
        const handleSubmit = renderForm();

        await userEvent.type(screen.getByPlaceholderText("Name"), "Station 1");
        await userEvent.click(screen.getByRole("radio", { name: "Room B" }));
        await userEvent.click(screen.getByRole("button", { name: "Add" }));

        expect(handleSubmit).toHaveBeenCalledWith(
            expect.objectContaining({ name: "Station 1", roomId: "room-b" })
        );
    });

    it("falls back to a select when there are too many rooms for buttons", () => {
        const manyRooms = Array.from({ length: 6 }, (_, i) => ({
            id: `room-${i}`,
            name: `Room ${i}`,
        })) as Room[];
        renderForm(vi.fn(), manyRooms);

        expect(screen.queryByRole("radio")).toBeNull();
        expect(screen.getByText("Select room")).toBeTruthy();
    });
});
