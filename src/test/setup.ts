import "@testing-library/jest-dom/vitest";

/* jsdom implements neither matchMedia nor IntersectionObserver, and the shell
   reads both on mount. */
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

if (!(window as Window & { IntersectionObserver?: unknown }).IntersectionObserver) {
  class Stub {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
    root = null;
    rootMargin = "";
    thresholds = [];
  }
  window.IntersectionObserver = Stub as unknown as typeof IntersectionObserver;
}
