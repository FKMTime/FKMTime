import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PreviewBanner from "./PreviewBanner";

describe("PreviewBanner", () => {
    it("links to the pull request the preview was built from", () => {
        render(
            <PreviewBanner
                prNumber="123"
                prUrl="https://github.com/example/repo/pull/123"
            />
        );
        const link = screen.getByRole("link", { name: "pull request #123" });
        expect(link.getAttribute("href")).toBe(
            "https://github.com/example/repo/pull/123"
        );
    });

    it("renders nothing outside a preview build", () => {
        const { container } = render(<PreviewBanner prNumber="" prUrl="" />);
        expect(container.firstChild).toBeNull();
    });
});
