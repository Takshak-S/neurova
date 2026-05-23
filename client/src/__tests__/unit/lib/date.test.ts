import { formatDistanceToNow, formatTime } from "@/lib/utils/date";

describe("formatDistanceToNow", () => {
    it("returns 'now' for < 1 min", () => {
        expect(formatDistanceToNow(new Date(Date.now() - 30000).toISOString())).toBe("now");
    });

    it("returns minutes", () => {
        expect(formatDistanceToNow(new Date(Date.now() - 5 * 60000).toISOString())).toBe("5m");
    });

    it("returns hours", () => {
        expect(formatDistanceToNow(new Date(Date.now() - 3 * 3600000).toISOString())).toBe("3h");
    });

    it("returns days", () => {
        expect(formatDistanceToNow(new Date(Date.now() - 2 * 86400000).toISOString())).toBe("2d");
    });
});

describe("formatTime", () => {
    it("returns a time string", () => {
        const r = formatTime(new Date().toISOString());
        expect(r).toMatch(/\d/);
    });
});