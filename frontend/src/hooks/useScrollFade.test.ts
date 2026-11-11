import { describe, expect, it } from "vitest";

import { getScrollEdges } from "./useScrollFade";

const strip = (scrollLeft: number, scrollWidth = 600, clientWidth = 300) =>
    ({ scrollLeft, scrollWidth, clientWidth }) as HTMLElement;

describe("getScrollEdges", () => {
    it("shows only the end fade at the start", () => {
        expect(getScrollEdges(strip(0))).toEqual({
            moreStart: false,
            moreEnd: true,
        });
    });

    it("shows both fades mid-scroll", () => {
        expect(getScrollEdges(strip(150))).toEqual({
            moreStart: true,
            moreEnd: true,
        });
    });

    it("shows only the start fade at the end, despite sub-pixel rounding", () => {
        expect(getScrollEdges(strip(299.5))).toEqual({
            moreStart: true,
            moreEnd: false,
        });
    });

    it("shows no fade when everything fits", () => {
        expect(getScrollEdges(strip(0, 300, 300))).toEqual({
            moreStart: false,
            moreEnd: false,
        });
    });
});
