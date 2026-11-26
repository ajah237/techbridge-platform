import { describe, it, expect } from "vitest";
import { splitEvents, isPastEvent } from "./eventStatus";
const now = new Date("2026-11-13T12:00:00Z").getTime();
describe("event ordering", () => {
  it("treats an event that already ended as past", () => {
    expect(isPastEvent({ start_date: "2026-06-01", end_date: "2026-08-01" }, now)).toBe(true);
  });
  it("treats a running event as current", () => {
    expect(isPastEvent({ start_date: "2026-11-10", end_date: "2026-11-20" }, now)).toBe(false);
  });
  it("lists current events soonest first and past most recent first", () => {
    const { current, past } = splitEvents([
      { start_date: "2026-06-01" }, { start_date: "2026-12-11" }, { start_date: "2026-08-01" }, { start_date: "2026-11-20" },
    ], now);
    expect(current.map((e) => e.start_date)).toEqual(["2026-11-20", "2026-12-11"]);
    expect(past.map((e) => e.start_date)).toEqual(["2026-08-01", "2026-06-01"]);
  });
});
