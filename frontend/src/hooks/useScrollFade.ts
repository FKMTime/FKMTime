import { useEffect, useRef } from "react";

// Sub-pixel scroll positions never quite reach the end on some phones
const EDGE_TOLERANCE_PX = 2;

/** Whether a horizontal scroller has more content past either edge */
export const getScrollEdges = (element: HTMLElement) => {
    const maxScroll = element.scrollWidth - element.clientWidth;
    return {
        moreStart: element.scrollLeft > EDGE_TOLERANCE_PX,
        moreEnd: element.scrollLeft < maxScroll - EDGE_TOLERANCE_PX,
    };
};

/**
 * Fades the edges of a horizontal strip whose scrollbar is hidden, on the
 * side(s) with more to scroll, so tabs past the edge don't look missing.
 * Pair the ref with the scroll-fade-x class; this only toggles the data
 * attributes it reads. Written to the DOM directly, so scrolling doesn't
 * re-render the strip.
 */
export const useScrollFade = <T extends HTMLElement>() => {
    const ref = useRef<T>(null);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        const update = () => {
            const { moreStart, moreEnd } = getScrollEdges(element);
            element.toggleAttribute("data-more-start", moreStart);
            element.toggleAttribute("data-more-end", moreEnd);
        };

        update();
        element.addEventListener("scroll", update, { passive: true });
        // Width changes (rotation, sidebar) and items added or removed
        const resizeObserver = new ResizeObserver(update);
        resizeObserver.observe(element);
        const mutationObserver = new MutationObserver(update);
        mutationObserver.observe(element, { childList: true });

        return () => {
            element.removeEventListener("scroll", update);
            resizeObserver.disconnect();
            mutationObserver.disconnect();
        };
    }, []);

    return ref;
};
