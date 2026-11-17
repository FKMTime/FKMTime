import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TutorialIncident } from "@/lib/tutorial";

import TutorialIncidentListItem from "./TutorialIncidentListItem";
import TutorialIncidentPanel from "./TutorialIncidentPanel";

const api = vi.hoisted(() => ({
    resolve: vi.fn(),
    remove: vi.fn(),
}));
vi.mock("@/lib/tutorial", () => ({
    resolveTutorialIncident: api.resolve,
    deleteTutorialIncident: api.remove,
}));
vi.mock("@/hooks/useLiveQuery", () => ({
    useLiveQuery: () => ({ data: [] }),
}));
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ toast }) }));

const incident: TutorialIncident = {
    id: "tutorial-1",
    espId: 3,
    deviceName: "Station 3",
    roomId: "room-1",
    competitorName: "Ada Example",
    judgeName: null,
    value: 1234,
    penalty: 0,
    inspectionTime: 8000,
    sessionId: "session-1",
    createdAt: "2026-11-17T09:00:00Z",
};

describe("TutorialIncidentPanel (SPEC-012)", () => {
    beforeEach(() => {
        api.resolve.mockReset().mockResolvedValue(200);
        api.remove.mockReset().mockResolvedValue(200);
        toast.mockReset();
    });

    it("says nothing is saved and leaves out what a tutorial doesn't have", () => {
        render(
            <TutorialIncidentPanel
                incident={incident}
                onClose={vi.fn()}
                onDone={vi.fn()}
            />
        );

        expect(
            screen.getByText(/Tutorial: nothing here is saved/)
        ).toBeInTheDocument();
        expect(screen.queryByText(/noteworthy/i)).not.toBeInTheDocument();
        expect(screen.queryByText("Judge")).not.toBeInTheDocument();
    });

    it("answers the station with the time as it stands", async () => {
        const onDone = vi.fn();
        render(
            <TutorialIncidentPanel
                incident={incident}
                onClose={vi.fn()}
                onDone={onDone}
            />
        );

        await userEvent.click(
            screen.getByRole("button", { name: "Mark as resolved" })
        );

        expect(api.resolve).toHaveBeenCalledWith("tutorial-1", {
            value: 1234,
            penalty: 0,
            status: "RESOLVED",
            doNotRequireCards: false,
        });
        expect(onDone).toHaveBeenCalled();
    });

    it("gives an extra from a quick action", async () => {
        render(
            <TutorialIncidentPanel
                incident={incident}
                onClose={vi.fn()}
                onDone={vi.fn()}
            />
        );

        await userEvent.click(screen.getByRole("button", { name: "A7G" }));

        expect(api.resolve).toHaveBeenCalledWith(
            "tutorial-1",
            expect.objectContaining({ status: "EXTRA_GIVEN" })
        );
    });

    it("says so when the station stopped waiting", async () => {
        api.remove.mockResolvedValue(404);
        const onDone = vi.fn();
        render(
            <TutorialIncidentPanel
                incident={incident}
                onClose={vi.fn()}
                onDone={onDone}
            />
        );

        await userEvent.click(screen.getByRole("button", { name: "Delete" }));

        expect(toast).toHaveBeenCalledWith({
            title: "The station stopped waiting for this tutorial incident",
        });
        expect(onDone).toHaveBeenCalled();
    });

    it("is marked as a tutorial in the list", () => {
        render(
            <MemoryRouter>
                <TutorialIncidentListItem
                    incident={incident}
                    roomName="Main Hall"
                    isSelected={false}
                    now={new Date("2026-11-17T09:04:00Z")}
                />
            </MemoryRouter>
        );

        expect(screen.getByText("Ada Example")).toBeInTheDocument();
        expect(screen.getByText("Tutorial")).toBeInTheDocument();
        expect(screen.getByText("12.34")).toBeInTheDocument();
    });
});
