import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Competition as WCIF } from "wcif-helpers";

import { createDevice, setStationsRound } from "@/lib/devices";
import { Device, Person, Room } from "@/lib/interfaces";
import { assignCard } from "@/lib/persons";
import { clearQueryCache } from "@/lib/queryCache";
import { getResultsByRoundId } from "@/lib/results";
import { sendStationPacket, StationExchange } from "@/lib/stationTester";
import { renderWithQueryClient } from "@/test/queryClient";

import FillGroupForm, { FILLER_STATION_NAME } from "./FillGroupForm";

vi.mock("@/lib/devices", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/devices")>()),
    createDevice: vi.fn(),
    setStationsRound: vi.fn(),
}));
vi.mock("@/lib/persons", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/persons")>()),
    assignCard: vi.fn(),
}));
vi.mock("@/lib/results", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/results")>()),
    getResultsByRoundId: vi.fn(),
}));
vi.mock("@/lib/stationTester", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/stationTester")>()),
    sendStationPacket: vi.fn(),
}));

const group = (id: number, activityCode: string) => ({
    id,
    activityCode,
    startTime: "2026-01-01T10:00:00Z",
    childActivities: [],
});

const wcif = {
    events: [
        {
            id: "333",
            rounds: [
                {
                    id: "333-r1",
                    format: "a",
                    timeLimit: { centiseconds: 60000, cumulativeRoundIds: [] },
                    cutoff: null,
                },
            ],
        },
        {
            id: "333bf",
            rounds: [
                {
                    id: "333bf-r1",
                    format: "3",
                    timeLimit: null,
                    cutoff: null,
                },
            ],
        },
    ],
    persons: [1, 2, 3].map((registrantId) => ({
        registrantId,
        name: `Competitor ${registrantId}`,
        registration: { status: "accepted", eventIds: ["333"] },
        assignments: [
            {
                activityId: registrantId === 3 ? 12 : 11,
                assignmentCode: "competitor",
                stationNumber: null,
            },
        ],
    })),
    schedule: {
        venues: [
            {
                rooms: [
                    {
                        activities: [
                            {
                                ...group(1, "333-r1"),
                                childActivities: [
                                    group(11, "333-r1-g1"),
                                    group(12, "333-r1-g2"),
                                ],
                            },
                            group(2, "333bf-r1"),
                        ],
                    },
                ],
            },
        ],
    },
} as unknown as WCIF;

const persons = [
    { id: "p1", registrantId: 1, name: "Competitor 1", cardId: "111" },
    { id: "p2", registrantId: 2, name: "Competitor 2" },
    { id: "p3", registrantId: 3, name: "Competitor 3", cardId: "333" },
] as Person[];

const rooms = [
    { id: "r1", name: "Room", currentGroupIds: [] },
] as unknown as Room[];

const exchange = (message: string, failed = false): StationExchange => ({
    sent: { type: "EnterAttempt", tag: 1, data: {} },
    reply: {
        type: "EnterAttempt",
        tag: 1,
        data: { message, error: failed },
        error: failed,
    },
    failed,
});

const onExchange = vi.fn();

const renderForm = (devices: Device[] = []) =>
    renderWithQueryClient(
        <FillGroupForm
            wcif={wcif}
            persons={persons}
            devices={devices}
            rooms={rooms}
            onExchange={onExchange}
            onDevicesChanged={() => {}}
        />
    );

const pickRound = async (
    user: ReturnType<typeof userEvent.setup>,
    name: string
) => {
    await user.click(screen.getByRole("combobox", { name: "Round" }));
    await user.click(await screen.findByRole("option", { name }));
};

describe("FillGroupForm", () => {
    beforeEach(() => {
        clearQueryCache();
        vi.clearAllMocks();
        vi.mocked(getResultsByRoundId).mockResolvedValue([]);
        vi.mocked(assignCard).mockResolvedValue(200);
        vi.mocked(setStationsRound).mockResolvedValue(200);
        vi.mocked(createDevice).mockResolvedValue({
            status: 201,
            device: {
                id: "d9",
                name: FILLER_STATION_NAME,
                espId: 5555,
            } as Device,
        });
        vi.mocked(sendStationPacket).mockResolvedValue(exchange("Saved"));
    });

    it("fills a group through a station of its own", async () => {
        const user = userEvent.setup();
        renderForm();

        await pickRound(user, "3x3x3 Cube · Round 1");
        await user.click(screen.getByRole("radio", { name: "Group 1" }));
        screen.getByText(/^2 competitors/);
        await user.click(
            screen.getByRole("button", { name: "Fill with results" })
        );

        await screen.findByText(/10\/10 attempts · Done/);
        // Competitor 2 had no card; Competitor 3 judges, and already had one
        expect(assignCard).toHaveBeenCalledTimes(1);
        expect(assignCard).toHaveBeenCalledWith("p2", expect.any(String));
        const newCard = +vi.mocked(assignCard).mock.calls[0][1];

        expect(createDevice).toHaveBeenCalledWith(
            expect.objectContaining({
                name: FILLER_STATION_NAME,
                type: "STATION",
                roomId: "r1",
            })
        );
        expect(vi.mocked(setStationsRound).mock.calls).toEqual([
            [["d9"], "333-r1"],
            [["d9"], null],
        ]);
        const packets = vi
            .mocked(sendStationPacket)
            .mock.calls.map(([, data]) => data as Record<string, unknown>);
        expect(packets).toHaveLength(10);
        expect(packets.filter((p) => p.competitorId === 111)).toHaveLength(5);
        expect(packets.filter((p) => p.competitorId === newCard)).toHaveLength(
            5
        );
        for (const packet of packets) {
            expect(packet).toMatchObject({
                espId: 5555,
                judgeId: 333,
                groupId: "333-r1-g1",
                isDelegate: false,
            });
        }
        // Every attempt is a solve of its own
        expect(new Set(packets.map((p) => p.sessionId)).size).toBe(10);
    });

    it("stops at the first refused attempt and shows the reply", async () => {
        const refused = exchange("Competitor is not signed in", true);
        vi.mocked(sendStationPacket)
            .mockResolvedValueOnce(exchange("Saved"))
            .mockResolvedValueOnce(refused);
        const user = userEvent.setup();
        renderForm([
            {
                id: "d1",
                name: FILLER_STATION_NAME,
                espId: 4321,
                type: "STATION",
            } as Device,
        ]);

        await pickRound(user, "3x3x3 Cube · Round 1");
        await user.click(
            screen.getByRole("button", { name: "Fill with results" })
        );

        await screen.findByText(
            "Stopped at Competitor 1: Competitor is not signed in"
        );
        screen.getByText("1/15 attempts");
        expect(sendStationPacket).toHaveBeenCalledTimes(2);
        expect(onExchange).toHaveBeenLastCalledWith(refused);
        // The station already existed, and goes back to its room afterwards
        expect(createDevice).not.toHaveBeenCalled();
        expect(setStationsRound).toHaveBeenLastCalledWith(["d1"], null);
    });

    it("stops when cancelled", async () => {
        let answer: (value: StationExchange) => void;
        vi.mocked(sendStationPacket).mockReturnValueOnce(
            new Promise((resolve) => (answer = resolve))
        );
        const user = userEvent.setup();
        renderForm();

        await pickRound(user, "3x3x3 Cube · Round 1");
        await user.click(
            screen.getByRole("button", { name: "Fill with results" })
        );
        await waitFor(() => expect(sendStationPacket).toHaveBeenCalled());
        await user.click(screen.getByRole("button", { name: "Cancel" }));
        answer!(exchange("Saved"));

        await screen.findByText(/1\/15 attempts · Cancelled/);
        expect(sendStationPacket).toHaveBeenCalledTimes(1);
    });

    it("explains why a blindfolded round isn't filled", async () => {
        const user = userEvent.setup();
        renderForm();

        await pickRound(user, "3x3x3 Blindfolded · Round 1");

        screen.getByText(/3x3x3 Blindfolded isn't filled/);
        expect(
            (
                screen.getByRole("button", {
                    name: "Fill with results",
                }) as HTMLButtonElement
            ).disabled
        ).toBe(true);
    });
});
