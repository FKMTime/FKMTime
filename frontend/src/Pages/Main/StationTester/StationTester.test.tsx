import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAllDevices } from "@/lib/devices";
import { assignCard, getAllPersons } from "@/lib/persons";
import { clearQueryCache } from "@/lib/queryCache";
import { getAllRooms } from "@/lib/rooms";
import { sendStationPacket } from "@/lib/stationTester";
import { renderWithQueryClient } from "@/test/queryClient";

import StationTester from "./StationTester";

const toast = vi.fn();
vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ toast }) }));
// The queries call these mocks, so the tests can stub them
vi.mock("@/lib/persons", async (importOriginal) => {
    const getAllPersonsMock = vi.fn();
    return {
        ...(await importOriginal<typeof import("@/lib/persons")>()),
        assignCard: vi.fn(),
        getAllPersons: getAllPersonsMock,
        allPersonsQuery: {
            key: "person/all?",
            fetch: () => getAllPersonsMock(),
        },
    };
});
vi.mock("@/lib/rooms", () => {
    const getAllRoomsMock = vi.fn();
    return {
        getAllRooms: getAllRoomsMock,
        roomsQuery: {
            key: "competition/rooms",
            fetch: () => getAllRoomsMock(),
        },
    };
});
vi.mock("@/lib/devices", async (importOriginal) => {
    const getAllDevicesMock = vi.fn();
    return {
        ...(await importOriginal<typeof import("@/lib/devices")>()),
        getAllDevices: getAllDevicesMock,
        stationDevicesQuery: {
            key: "device?type=STATION",
            fetch: () => getAllDevicesMock(),
        },
    };
});
vi.mock("@/lib/stationTester", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/stationTester")>()),
    sendStationPacket: vi.fn(),
}));

const acceptedExchange = (type: string, message: string) => ({
    sent: { type, tag: 1, data: {} },
    reply: { type: `${type}Resp`, tag: 1, data: { message, error: false } },
    failed: false,
});

const renderPage = async () => {
    renderWithQueryClient(<StationTester />);
    return await screen.findByLabelText("Session ID");
};

const fillCompetitor = (user: ReturnType<typeof userEvent.setup>) =>
    user.type(screen.getByLabelText("Competitor card"), "123");

const sendAttempt = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("button", { name: "Send attempt" }));
    await waitFor(() => expect(sendStationPacket).toHaveBeenCalled());
};

describe("StationTester", () => {
    beforeEach(() => {
        clearQueryCache();
        vi.clearAllMocks();
        vi.mocked(getAllPersons).mockResolvedValue([
            { id: "p1", name: "Alex Example", cardId: "111" },
            { id: "p2", name: "Casey Tester" },
        ]);
        vi.mocked(getAllDevices).mockResolvedValue([
            { id: "d1", name: "Station 1", espId: 4321, roomId: "r1" },
        ]);
        vi.mocked(getAllRooms).mockResolvedValue([
            { id: "r1", name: "Room", currentGroupIds: ["333-r1-g1"] },
        ]);
        vi.mocked(sendStationPacket).mockResolvedValue(
            acceptedExchange("EnterAttempt", "Saved")
        );
    });

    it("sends a new session ID each time", async () => {
        const user = userEvent.setup();
        const sessionInput = (await renderPage()) as HTMLInputElement;
        const firstSession = sessionInput.value;
        expect(firstSession).not.toBe("");
        await fillCompetitor(user);

        await sendAttempt(user);

        await waitFor(() => expect(sessionInput.value).not.toBe(firstSession));
        expect(vi.mocked(sendStationPacket).mock.calls[0]).toEqual([
            "EnterAttempt",
            expect.objectContaining({
                competitorId: 123,
                espId: 4321,
                sessionId: firstSession,
            }),
        ]);
    });

    it("keeps a typed session ID when asked to", async () => {
        const user = userEvent.setup();
        const sessionInput = (await renderPage()) as HTMLInputElement;
        await fillCompetitor(user);
        await user.clear(sessionInput);
        await user.type(sessionInput, "my-session");
        await user.click(
            screen.getByRole("switch", {
                name: /New session ID after each send/,
            })
        );

        await sendAttempt(user);
        await screen.findByLabelText("Raw reply");

        expect(sessionInput.value).toBe("my-session");
    });

    it("shows the reply to the latest send, not the one before", async () => {
        const user = userEvent.setup();
        await renderPage();
        await fillCompetitor(user);
        await sendAttempt(user);
        expect(
            (await screen.findByLabelText("Raw reply")).textContent
        ).toContain("Saved");

        let answer: (value: ReturnType<typeof acceptedExchange>) => void;
        vi.mocked(sendStationPacket).mockReturnValue(
            new Promise((resolve) => (answer = resolve))
        );
        await user.click(screen.getByRole("button", { name: "Send attempt" }));

        expect(screen.queryByLabelText("Raw reply")).toBeNull();
        screen.getByText("Waiting for the reply...");

        answer!(acceptedExchange("EnterAttempt", "Second answer"));
        expect(
            (await screen.findByLabelText("Raw reply")).textContent
        ).toContain("Second answer");
    });

    it("gives a picked person without a card a new one", async () => {
        vi.mocked(assignCard).mockResolvedValue(200);
        const user = userEvent.setup();
        await renderPage();

        await user.click(screen.getAllByText("Select person...")[0]);
        await user.click(await screen.findByText("Casey Tester"));

        await waitFor(() =>
            expect(assignCard).toHaveBeenCalledWith("p2", expect.any(String))
        );
        const cardId = vi.mocked(assignCard).mock.calls[0][1];
        await waitFor(() =>
            expect(
                (screen.getByLabelText("Competitor card") as HTMLInputElement)
                    .value
            ).toBe(cardId)
        );
    });
});
