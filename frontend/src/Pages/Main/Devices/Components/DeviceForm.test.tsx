import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComponentProps } from "react";
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

const renderForm = (
    handleSubmit = vi.fn(),
    formRooms = rooms,
    props: Partial<ComponentProps<typeof DeviceForm>> = {}
) => {
    render(
        <DeviceForm
            defaultValues={defaultValues}
            handleSubmit={handleSubmit}
            rooms={formRooms}
            availableTypes={[DeviceType.STATION]}
            availableHwVersions={[HardwareVersion.V3]}
            submitText="Add"
            isLoading={false}
            {...props}
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

    it("skips the room field and uses the only room when there is one", async () => {
        const handleSubmit = renderForm(vi.fn(), [rooms[0]]);

        expect(screen.queryByText("Room")).toBeNull();
        await userEvent.type(screen.getByPlaceholderText("Name"), "Station 1");
        await userEvent.click(screen.getByRole("button", { name: "Add" }));

        expect(handleSubmit).toHaveBeenCalledWith(
            expect.objectContaining({ name: "Station 1", roomId: "room-a" })
        );
    });

    it("shows the type and hardware only when there is a choice", () => {
        renderForm(vi.fn(), rooms, {
            availableTypes: [
                DeviceType.ATTENDANCE_SCRAMBLER,
                DeviceType.ATTENDANCE_RUNNER,
            ],
        });

        expect(screen.getByText("Device type")).toBeTruthy();
        expect(screen.queryByText("Hardware version")).toBeNull();
    });

    it("keeps a device's own ESP ID read-only but still submits it", async () => {
        const handleSubmit = renderForm(vi.fn(), [rooms[0]], {
            defaultValues: { ...defaultValues, espId: 0xabc123 },
            espIdLocked: true,
        });

        const espId = screen.getByPlaceholderText("ESP ID") as HTMLInputElement;
        expect(espId.disabled).toBe(true);
        expect(espId.value).toBe("ABC123");
        expect(screen.queryByText("Device type")).toBeNull();

        await userEvent.type(screen.getByPlaceholderText("Name"), "Station 1");
        await userEvent.click(screen.getByRole("button", { name: "Add" }));

        expect(handleSubmit).toHaveBeenCalledWith(
            expect.objectContaining({ espId: 0xabc123, roomId: "room-a" })
        );
    });
});
