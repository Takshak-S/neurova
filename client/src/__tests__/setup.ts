import "@testing-library/jest-dom";

jest.mock("next/navigation", () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
    useParams: () => ({}),
    usePathname: () => "/",
}));

const mockIDB: any = {};
global.indexedDB = {
    open: jest.fn().mockReturnValue({ onsuccess: null, onerror: null }),
} as any;

Object.defineProperty(global, "crypto", {
    value: {
        subtle: {
            generateKey: jest.fn(),
            exportKey: jest.fn(),
            importKey: jest.fn(),
            encrypt: jest.fn(),
            decrypt: jest.fn(),
        },
        getRandomValues: (arr: Uint8Array) => {
            for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
            return arr;
        },
    },
});

const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, val: string) => { store[key] = val; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; },
    };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });
Object.defineProperty(window, "sessionStorage", { value: localStorageMock });

export {};