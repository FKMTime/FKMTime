import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import ResultPageLink from "./ResultPageLink";

const renderLink = (canGiveExtrasForSeveral: boolean) =>
    render(
        <MemoryRouter>
            <ResultPageLink
                resultId="result-1"
                canGiveExtrasForSeveral={canGiveExtrasForSeveral}
            />
        </MemoryRouter>
    );

describe("ResultPageLink", () => {
    it("opens the result without extras for several attempts", () => {
        renderLink(false);

        expect(
            screen
                .getByRole("link", { name: "Open result" })
                .getAttribute("href")
        ).toBe("/results/result-1");
    });

    it("offers extras for several attempts when they can be given", () => {
        renderLink(true);

        expect(
            screen
                .getByRole("link", {
                    name: "Several attempts affected? Give extras on the result page",
                })
                .getAttribute("href")
        ).toBe("/results/result-1");
    });
});
