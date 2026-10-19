// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";

// jsdom lacks APIs Radix popovers and menus rely on
class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub;
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

// Evaluates (max-width: Npx) against innerWidth so tests can emulate mobile
window.matchMedia ??= (query: string) => {
    const maxWidth = /max-width:\s*(\d+)px/.exec(query);
    return {
        matches: maxWidth ? window.innerWidth <= Number(maxWidth[1]) : false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
    } as MediaQueryList;
};
