import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pencil, Trash2 } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RoundOption } from "@/lib/roundOptions";

import RoundStrip from "./RoundStrip";
import RowActions from "./RowActions";

const round = (
    id: string,
    eventId: string,
    eventName: string,
    label: string,
    liveRooms: string[] = []
): RoundOption => ({
    id,
    eventId,
    eventName,
    label,
    name: `${eventName} · Round ${id.split("-r")[1]}`,
    liveRooms,
    isLive: liveRooms.length > 0,
});

const all = [
    round("333-r1", "333", "3x3x3 Cube", "3x3 R1", ["Main room"]),
    round("333-r2", "333", "3x3x3 Cube", "3x3 R2"),
    round("pyram-r1", "pyram", "Pyraminx", "Pyra R1", ["Side room"]),
];

describe("RoundStrip", () => {
    it("shows live rooms for live rounds and the caller's subtitle otherwise", () => {
        render(
            <RoundStrip
                rounds={[all[0], all[1]]}
                allRounds={all}
                value="333-r2"
                onValueChange={vi.fn()}
                getSubtitle={() => "12 results"}
            />
        );
        const strip = screen.getByRole("radiogroup", {
            name: "Current rounds",
        });
        expect(within(strip).getByText("Main room")).toBeTruthy();
        expect(within(strip).getByText("12 results")).toBeTruthy();
        expect(
            within(strip)
                .getByRole("radio", { name: /3x3 R2/ })
                .getAttribute("aria-checked")
        ).toBe("true");
    });

    it("searches all rounds grouped by event and picks one", async () => {
        const onValueChange = vi.fn();
        render(
            <RoundStrip
                rounds={[all[0]]}
                allRounds={all}
                value="333-r1"
                onValueChange={onValueChange}
            />
        );
        await userEvent.click(
            screen.getByRole("button", { name: "All rounds (3)" })
        );
        expect(await screen.findByText("Pyraminx")).toBeTruthy();
        expect(screen.getByText("3x3x3 Cube · Round 2")).toBeTruthy();

        await userEvent.type(screen.getByLabelText("Search rounds"), "pyra");
        expect(screen.queryByText("3x3x3 Cube · Round 2")).toBeNull();
        await userEvent.click(screen.getByText("Pyraminx · Round 1"));
        expect(onValueChange).toHaveBeenCalledWith("pyram-r1");

        await userEvent.click(
            screen.getByRole("button", { name: "All rounds (3)" })
        );
        await userEvent.type(screen.getByLabelText("Search rounds"), "zzz");
        expect(screen.getByText("No rounds match")).toBeTruthy();
    });
});

describe("RowActions on mobile", () => {
    afterEach(() => {
        window.innerWidth = 1024;
    });

    it("opens a bottom sheet titled with the row subject", async () => {
        window.innerWidth = 375;
        const onDelete = vi.fn();
        render(
            <RowActions
                subject="Anna Example"
                items={[
                    {
                        label: "Delete",
                        icon: Trash2,
                        onSelect: onDelete,
                        destructive: true,
                    },
                    { label: "Edit", icon: Pencil, onSelect: vi.fn() },
                ]}
            />
        );
        await userEvent.click(
            screen.getByRole("button", {
                name: "More actions for Anna Example",
            })
        );
        const sheet = await screen.findByRole("dialog");
        expect(within(sheet).getByText("Anna Example")).toBeTruthy();
        const buttons = within(sheet).getAllByRole("button");
        expect(buttons.map((b) => b.textContent)).toEqual(["Edit", "Delete"]);
        await userEvent.click(buttons[1]);
        expect(onDelete).toHaveBeenCalled();
    });
});
