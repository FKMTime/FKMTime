import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider } from "jotai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { competitionAtom } from "@/lib/atoms";
import { setStationsRound } from "@/lib/devices";
import { Competition, DeviceType } from "@/lib/interfaces";
import { clearQueryCache } from "@/lib/queryCache";
import { renderWithQueryClient } from "@/test/queryClient";

import RunDifferentRoundModal from "./RunDifferentRoundModal";

const station = (id: string, name: string, roomId: string, extra = {}) => ({
    id,
    name,
    roomId,
    espId: 1,
    type: DeviceType.STATION,
    ...extra,
});

vi.mock("@/lib/devices", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/devices")>();
    return {
        ...actual,
        setStationsRound: vi.fn(),
        devicesQuery: {
            key: "device",
            fetch: async () => [
                station("s1", "Station 1", "main"),
                station("s2", "Station 2", "main", {
                    customRoundId: "pyram-r1",
                }),
                station("s3", "Station 3", "side"),
                {
                    ...station("a1", "Attendance", "main"),
                    type: DeviceType.ATTENDANCE_RUNNER,
                },
            ],
        },
    };
});
vi.mock("@/lib/rooms", () => ({
    roomsQuery: {
        key: "competition/rooms",
        fetch: async () => [
            { id: "main", name: "Main Room", currentGroupIds: [] },
            { id: "side", name: "Side Room", currentGroupIds: [] },
        ],
    },
}));
vi.mock("@/hooks/useToast", () => ({
    useToast: () => ({ toast: vi.fn() }),
}));

const renderModal = (
    props: Partial<Parameters<typeof RunDifferentRoundModal>[0]> = {}
) => {
    const store = createStore();
    store.set(competitionAtom, {
        wcif: {
            events: [
                { id: "333", rounds: [{ id: "333-r1" }, { id: "333-r2" }] },
                { id: "pyram", rounds: [{ id: "pyram-r1" }] },
            ],
        },
    } as unknown as Competition);
    const onClose = vi.fn();
    renderWithQueryClient(
        <Provider store={store}>
            <RunDifferentRoundModal isOpen onClose={onClose} {...props} />
        </Provider>
    );
    return { onClose };
};

beforeEach(() => {
    clearQueryCache();
    vi.mocked(setStationsRound).mockReset();
});

describe("RunDifferentRoundModal", () => {
    it("lists only stations, by room, with the one it was opened from ticked", async () => {
        renderModal({ initialStationIds: ["s1"], initialRoundId: "333-r1" });

        const ticked = await screen.findByRole("checkbox", {
            name: "Station 1",
        });
        expect(ticked.getAttribute("data-state")).toBe("checked");
        expect(screen.getByText("Side Room")).toBeTruthy();
        expect(screen.queryByText("Attendance")).toBeNull();
        expect(screen.getByText(/now Pyraminx, Round 1/)).toBeTruthy();
        expect(
            screen.getByText(
                "Station 1 will only take attempts for 3x3x3 Cube, Round 1. Other stations carry on with their room's groups."
            )
        ).toBeTruthy();
    });

    it("points every ticked station at the round", async () => {
        vi.mocked(setStationsRound).mockResolvedValue(200);
        const { onClose } = renderModal({
            initialStationIds: ["s1"],
            initialRoundId: "333-r1",
        });

        await userEvent.click(
            await screen.findByRole("checkbox", { name: "Station 3" })
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Run this round" })
        );

        expect(setStationsRound).toHaveBeenCalledWith(["s1", "s3"], "333-r1");
        await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it("needs a round and a station", async () => {
        renderModal();

        await screen.findByRole("checkbox", { name: "Station 1" });
        expect(
            (
                screen.getByRole("button", {
                    name: "Run this round",
                }) as HTMLButtonElement
            ).disabled
        ).toBe(true);
    });

    it("explains a refusal for someone who isn't a delegate", async () => {
        vi.mocked(setStationsRound).mockResolvedValue(403);
        const { onClose } = renderModal({
            initialStationIds: ["s1"],
            initialRoundId: "333-r1",
        });

        await screen.findByRole("checkbox", { name: "Station 1" });
        await userEvent.click(
            screen.getByRole("button", { name: "Run this round" })
        );

        expect(
            await screen.findByText(
                "Only a delegate can change which round a station runs"
            )
        ).toBeTruthy();
        expect(onClose).not.toHaveBeenCalled();
    });
});
