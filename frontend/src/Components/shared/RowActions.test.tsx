import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pencil, Trash2 } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";

import RowActions from "./RowActions";

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
