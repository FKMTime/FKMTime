import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pencil, Trash2, UserX } from "lucide-react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import EmptyState from "./EmptyState";
import EventChips from "./EventChips";
import InlineError from "./InlineError";
import PageTabs from "./PageTabs";
import ProgressBar from "./ProgressBar";
import RowActions from "./RowActions";
import SegmentedControl from "./SegmentedControl";
import StationCard from "./StationCard";

describe("PageTabs", () => {
    const tabs = [
        { value: "open", label: "Open", count: 3, to: "/incidents" },
        {
            value: "resolved",
            label: "Resolved",
            count: 0,
            to: "/incidents/resolved",
        },
    ];

    it("renders route tabs as links with counts and marks the active one", () => {
        render(
            <MemoryRouter>
                <PageTabs tabs={tabs} value="open" label="Incidents" />
            </MemoryRouter>
        );
        const open = screen.getByRole("tab", { name: "Open 3" });
        expect(open.getAttribute("href")).toBe("/incidents");
        expect(open.getAttribute("aria-selected")).toBe("true");
        expect(
            screen
                .getByRole("tab", { name: "Resolved 0" })
                .getAttribute("aria-selected")
        ).toBe("false");
    });

    it("works as controlled in-page tabs", async () => {
        const onValueChange = vi.fn();
        render(
            <PageTabs
                tabs={[
                    { value: "a", label: "Rounds" },
                    { value: "b", label: "Checks" },
                ]}
                value="a"
                onValueChange={onValueChange}
                label="Results"
            />
        );
        await userEvent.click(screen.getByRole("tab", { name: "Checks" }));
        expect(onValueChange).toHaveBeenCalledWith("b");
    });
});

describe("SegmentedControl", () => {
    it("selects an option and shows badges", async () => {
        const onValueChange = vi.fn();
        render(
            <SegmentedControl
                label="Room"
                value="all"
                onValueChange={onValueChange}
                options={[
                    { value: "all", label: "All rooms" },
                    { value: "main", label: "Main Room", badge: 2 },
                ]}
            />
        );
        expect(
            screen
                .getByRole("radio", { name: "All rooms" })
                .getAttribute("aria-checked")
        ).toBe("true");
        await userEvent.click(screen.getByRole("radio", { name: /Main Room/ }));
        expect(onValueChange).toHaveBeenCalledWith("main");
        expect(screen.getByText("2")).toBeTruthy();
    });
});

describe("EventChips", () => {
    it("marks live events and reports the picked event", async () => {
        const onValueChange = vi.fn();
        render(
            <EventChips
                value="333"
                onValueChange={onValueChange}
                events={[
                    { id: "333", label: "3x3", name: "3x3x3 Cube", live: true },
                    { id: "pyram", label: "Pyra", name: "Pyraminx" },
                ]}
            />
        );
        expect(
            screen.getByRole("radio", { name: "3x3x3 Cube, live" })
        ).toBeTruthy();
        await userEvent.click(screen.getByRole("radio", { name: "Pyraminx" }));
        expect(onValueChange).toHaveBeenCalledWith("pyram");
    });
});

describe("RowActions", () => {
    it("shows the primary action and puts destructive items last after a separator", async () => {
        const onEdit = vi.fn();
        const onDelete = vi.fn();
        render(
            <RowActions
                subject="Anna Example"
                primary={{ label: "Edit", icon: Pencil, onSelect: onEdit }}
                items={[
                    {
                        label: "Delete",
                        icon: Trash2,
                        onSelect: onDelete,
                        destructive: true,
                    },
                    { label: "Mark absent", icon: UserX, onSelect: vi.fn() },
                    {
                        label: "Hidden",
                        icon: UserX,
                        onSelect: vi.fn(),
                        hidden: true,
                    },
                ]}
            />
        );

        await userEvent.click(screen.getByRole("button", { name: "Edit" }));
        expect(onEdit).toHaveBeenCalled();

        await userEvent.click(
            screen.getByRole("button", {
                name: "More actions for Anna Example",
            })
        );
        const menu = await screen.findByRole("menu");
        const items = within(menu).getAllByRole("menuitem");
        expect(items.map((i) => i.textContent)).toEqual([
            "Mark absent",
            "Delete",
        ]);
        expect(within(menu).getAllByRole("separator")).toHaveLength(1);

        await userEvent.click(items[1]);
        expect(onDelete).toHaveBeenCalled();
    });

    it("omits the menu when there are no secondary actions", () => {
        render(
            <RowActions
                subject="Anna Example"
                primary={{ label: "Edit", icon: Pencil, onSelect: vi.fn() }}
            />
        );
        expect(
            screen.queryByRole("button", { name: /More actions/ })
        ).toBeNull();
    });
});

describe("StationCard", () => {
    it("shows the running time while solving", () => {
        render(
            <StationCard
                deviceName="Station 1"
                competitorName="Anna Example"
                phase="solving"
                time="12.34"
            />
        );
        expect(screen.getByText("Solving")).toBeTruthy();
        expect(screen.getByText("12.34")).toBeTruthy();
        expect(screen.getByText("AE")).toBeTruthy();
    });

    it("hides the time while waiting or offline", () => {
        const { rerender } = render(
            <StationCard deviceName="Station 2" phase="idle" time="0.00" />
        );
        expect(screen.getByText("Waiting")).toBeTruthy();
        expect(screen.getByText("No competitor")).toBeTruthy();
        expect(screen.queryByText("0.00")).toBeNull();

        rerender(
            <StationCard deviceName="Station 2" phase="offline" time="9.99" />
        );
        expect(screen.getByText("Offline")).toBeTruthy();
        expect(screen.queryByText("9.99")).toBeNull();
    });

    it("flags incidents and shows the cumulative limit", () => {
        render(
            <StationCard
                deviceName="Station 3"
                competitorName="Jan Test"
                phase="finished"
                time="15.74"
                hasIncident
                cumulative={{ remaining: "3:12.00", limit: "5:00.00" }}
            />
        );
        expect(screen.getByText("Incident")).toBeTruthy();
        expect(screen.getByText("Finished")).toBeTruthy();
        expect(screen.getByText("Cumulative limit")).toBeTruthy();
        expect(screen.getByText("3:12.00")).toBeTruthy();
    });
});

describe("small components", () => {
    it("InlineError renders nothing without a message", () => {
        const { container, rerender } = render(<InlineError>{""}</InlineError>);
        expect(container.innerHTML).toBe("");
        rerender(<InlineError>Wrong code</InlineError>);
        expect(screen.getByRole("alert").textContent).toBe("Wrong code");
    });

    it("ProgressBar clamps its fill and exposes the values", () => {
        render(<ProgressBar value={90} max={80} label="Results entered" />);
        const bar = screen.getByRole("progressbar", {
            name: "Results entered",
        });
        expect(bar.getAttribute("aria-valuenow")).toBe("90");
        expect((bar.firstChild as HTMLElement).style.width).toBe("100%");
    });

    it("EmptyState renders its message and action", () => {
        render(
            <EmptyState action={<button>Add</button>}>
                Select an incident to review it.
            </EmptyState>
        );
        expect(
            screen.getByText("Select an incident to review it.")
        ).toBeTruthy();
        expect(screen.getByRole("button", { name: "Add" })).toBeTruthy();
    });
});
