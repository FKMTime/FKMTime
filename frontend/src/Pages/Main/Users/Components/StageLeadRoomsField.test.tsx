import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StageLeadRoomsValue } from "@/lib/stageLeadRooms";

import StageLeadRoomsField from "./StageLeadRoomsField";

const ROOMS = [
    { id: "main", name: "Main Hall" },
    { id: "side", name: "Side Hall" },
];

const onChange = vi.fn<(value: StageLeadRoomsValue) => void>();
const latest = () => onChange.mock.lastCall?.[0];

const Field = ({
    roles = ["STAGE_LEADER"],
    rooms = ROOMS,
}: {
    roles?: string[];
    rooms?: typeof ROOMS;
}) => {
    const [value, setValue] = useState<StageLeadRoomsValue>({
        allRooms: false,
        roomIds: [],
    });
    return (
        <StageLeadRoomsField
            roles={roles}
            rooms={rooms}
            value={value}
            onChange={(next) => {
                setValue(next);
                onChange(next);
            }}
        />
    );
};

describe("StageLeadRoomsField", () => {
    beforeEach(() => onChange.mockClear());

    it("asks for at least one room until one is ticked", async () => {
        render(<Field />);
        expect(screen.getByText("Choose at least one room")).toBeTruthy();

        await userEvent.click(screen.getByLabelText("Side Hall"));

        expect(latest()).toEqual({ allRooms: false, roomIds: ["side"] });
        expect(screen.queryByText("Choose at least one room")).toBeNull();
    });

    it("ticks every room with All rooms", async () => {
        render(<Field />);
        await userEvent.click(screen.getByLabelText("All rooms"));

        expect(latest()).toEqual({ allRooms: true, roomIds: [] });
        const main = screen.getByLabelText("Main Hall");
        expect(main.getAttribute("data-state")).toBe("checked");
        expect(main.hasAttribute("disabled")).toBe(true);
    });

    it("treats every room ticked by hand as all rooms", async () => {
        render(<Field />);
        await userEvent.click(screen.getByLabelText("Main Hall"));
        await userEvent.click(screen.getByLabelText("Side Hall"));

        expect(latest()).toEqual({ allRooms: true, roomIds: [] });
    });

    it("hides itself with one room, and for organizers", () => {
        const { container, rerender } = render(
            <Field rooms={ROOMS.slice(0, 1)} />
        );
        expect(container.textContent).toBe("");
        rerender(<Field roles={["STAGE_LEADER", "ORGANIZER"]} />);
        expect(container.textContent).toBe("");
    });
});
