import "@testing-library/jest-dom/vitest";

/* jsdom 25 moved localStorage behind an explicit test option. Provide a
   minimal in-memory implementation so modules that touch it (e.g. the
   cross-tab refresh lock) do not throw in tests. */
if (typeof globalThis.localStorage === "undefined") {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (i: number) => [...store.keys()][i] ?? null,
  } as unknown as Storage;
}

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
