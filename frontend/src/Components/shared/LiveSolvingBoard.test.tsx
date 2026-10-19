import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { StationInfo } from "@/lib/liveSolving";

import LiveSolvingBoard from "./LiveSolvingBoard";

const rooms = [
    { id: "main", name: "Main Room", currentGroupIds: [] },
    { id: "side", name: "Side Room", currentGroupIds: [] },
];

const station = (espId: number, roomId: string | null): StationInfo => ({
    espId,
    deviceName: `Station ${espId}`,
    roomId,
    personName: null,
    registrantId: null,
    groupId: null,
    time: null,
    inspection: null,
    cumulativeLimitCentiseconds: null,
    cumulativeRemainingCentiseconds: null,
    // Never heard from, so offline
    serverReceivedAt: 0,
});

const stations = [station(1, "main"), station(2, "side"), station(3, "side")];

describe("LiveSolvingBoard", () => {
    it("groups stations under their room", () => {
        render(<LiveSolvingBoard stations={stations} rooms={rooms} />);
        const side = screen.getByRole("region", { name: "Side Room" });
        expect(within(side).getByText("Station 2")).toBeTruthy();
        expect(within(side).getByText("Station 3")).toBeTruthy();
        expect(within(side).queryByText("Station 1")).toBeNull();
    });

    it("counts offline stations only when asked to", () => {
        const { rerender } = render(
            <LiveSolvingBoard stations={stations} rooms={rooms} />
        );
        expect(screen.queryByText("offline")).toBeNull();
        rerender(
            <LiveSolvingBoard
                stations={stations}
                rooms={rooms}
                showOfflineCount
            />
        );
        expect(screen.getByText("offline").textContent).toBe("3offline");
    });

    it("filters to one room", async () => {
        render(
            <LiveSolvingBoard
                stations={stations}
                rooms={rooms}
                allRoomsLabel="All rooms"
            />
        );
        expect(screen.getByRole("radio", { name: "All rooms" })).toBeTruthy();
        await userEvent.click(screen.getByRole("radio", { name: "Main Room" }));
        expect(screen.queryByRole("region", { name: "Side Room" })).toBeNull();
        expect(screen.getByText("Station 1")).toBeTruthy();
    });
});
