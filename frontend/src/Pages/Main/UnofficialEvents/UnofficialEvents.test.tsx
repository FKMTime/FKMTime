import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearQueryCache, QueryError } from "@/lib/queryCache";
import { queryClient } from "@/lib/queryClient";
import { ConfirmProvider } from "@/providers/ConfirmProvider";
import { renderWithQueryClient } from "@/test/queryClient";

import UnofficialEvents from "./UnofficialEvents";

const fetchEvents = vi.hoisted(() => vi.fn());

vi.mock("@/lib/unofficialEvents", () => ({
    unofficialEventsQuery: { key: "events/unofficial", fetch: fetchEvents },
}));
// The tabs prefetch the other Setup pages and the modal loads the event
// list, neither of which this test needs
vi.mock("@/Pages/Main/Setup/SetupTabs", () => ({ default: () => null }));
vi.mock("./Components/CreateUnofficialEventModal", () => ({
    default: () => null,
}));

const renderPage = () =>
    renderWithQueryClient(
        <ConfirmProvider>
            <UnofficialEvents />
        </ConfirmProvider>
    );

const event = {
    id: "event-1",
    eventId: "fto",
    wcif: { id: "fto", rounds: [] },
};

describe("UnofficialEvents", () => {
    beforeEach(() => {
        clearQueryCache();
        fetchEvents.mockReset();
    });

    it("offers a retry when the first load fails", async () => {
        fetchEvents
            .mockRejectedValueOnce(new QueryError(500))
            .mockResolvedValueOnce([]);
        renderPage();

        expect(await screen.findByText(/Couldn't load this page/)).toBeTruthy();
        await userEvent.click(
            screen.getByRole("button", { name: "Try again" })
        );

        expect(
            await screen.findByText("No unofficial events yet")
        ).toBeTruthy();
        expect(screen.queryByText(/Couldn't load/)).toBeNull();
    });

    it("keeps the list when a refresh fails", async () => {
        fetchEvents.mockResolvedValueOnce([event]);
        renderPage();
        expect(await screen.findByRole("listitem")).toBeTruthy();

        fetchEvents.mockRejectedValueOnce(new QueryError(503));
        await queryClient.refetchQueries({ queryKey: ["events/unofficial"] });

        expect(await screen.findByText(/Couldn't refresh/)).toBeTruthy();
        expect(screen.getByRole("listitem")).toBeTruthy();
    });
});
