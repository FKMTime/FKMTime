import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { DelegateGrantPermission } from "@/lib/delegateGrants";

import ResultPageLink from "./ResultPageLink";

const SEVERAL_TEXT =
    "Several attempts affected? Give extras on the result page";

/** A user whose active grant includes exactly these permissions */
const granted =
    (...permissions: DelegateGrantPermission[]) =>
    (permission: DelegateGrantPermission) =>
        permissions.includes(permission);

const renderLink = (can: (permission: DelegateGrantPermission) => boolean) =>
    render(
        <MemoryRouter>
            <ResultPageLink resultId="result-1" can={can} />
        </MemoryRouter>
    );

describe("ResultPageLink", () => {
    it("opens the result for a grant with the default permissions", () => {
        renderLink(granted("GIVE_EXTRA", "ADD_ATTEMPT", "REORDER_ATTEMPTS"));

        expect(
            screen
                .getByRole("link", { name: "Open result" })
                .getAttribute("href")
        ).toBe("/results/result-1");
    });

    it.each<DelegateGrantPermission>([
        "ADD_ATTEMPT",
        "REORDER_ATTEMPTS",
        "EDIT_ATTEMPT",
        "DELETE_ATTEMPT",
        "DNF_ALL",
    ])("shows for a grant with only %s", (permission) => {
        renderLink(granted(permission));

        expect(screen.getByRole("link", { name: "Open result" })).toBeTruthy();
    });

    it("offers extras for several attempts when the grant includes it", () => {
        renderLink(granted("ADD_ATTEMPT", "EXTRAS_FOR_SEVERAL"));

        expect(
            screen
                .getByRole("link", { name: SEVERAL_TEXT })
                .getAttribute("href")
        ).toBe("/results/result-1");
    });

    it("offers extras for several attempts to a delegate", () => {
        renderLink(() => true);

        expect(screen.getByRole("link", { name: SEVERAL_TEXT })).toBeTruthy();
    });

    it("is hidden when nothing granted is done on the result page", () => {
        renderLink(granted("GIVE_EXTRA"));

        expect(screen.queryByRole("link")).toBeNull();
    });
});
