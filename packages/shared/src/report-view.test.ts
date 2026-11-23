import { describe, expect, it } from "vitest";
import { addDays, inView, mondayOf, parseView, rangeLabel, viewLabel, viewQuery, weekColumns } from "./report-view";

describe("weeks", () => {
  it("finds the Monday, also from a Sunday", () => {
    expect(mondayOf("2026-11-22")).toBe("2026-11-16");
    expect(mondayOf("2026-11-16")).toBe("2026-11-16");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("reads a week from the address, with neighbours", () => {
    const view = parseView({ week: "2026-11-19" });
    expect(view).toMatchObject({ mode: "week", from: "2026-11-16", to: "2026-11-22", previous: "2026-11-09", next: "2026-11-23" });
    expect(inView(view, "2026-11-22T09:00:00+00:00")).toBe(true);
    expect(inView(view, "2026-11-23")).toBe(false);
    expect(weekColumns(view, ["2026-11-21"])).toEqual(["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21"]);
  });
});

describe("ranges and labels", () => {
  it("swaps a reversed range and ignores bad dates", () => {
    expect(parseView({ view: "range", from: "2026-11-20", to: "2026-11-02" })).toEqual({ mode: "range", from: "2026-11-02", to: "2026-11-20" });
    expect(parseView({ view: "range", from: "nonsense", to: "2026-11-02" }).mode).toBe("week");
    expect(parseView({ view: "all" })).toEqual({ mode: "all" });
  });
  it("writes dates without dashes", () => {
    expect(rangeLabel("2026-11-16", "2026-11-22")).toBe("16 to 22 Nov 2026");
    expect(rangeLabel("2026-11-30", "2026-12-06")).toBe("30 Nov to 6 Dec 2026");
    expect(rangeLabel("2026-12-28", "2027-01-03")).toBe("28 Dec 2026 to 3 Jan 2027");
    expect(viewLabel({ mode: "all" }, "Whole term")).toBe("Whole term");
  });
  it("builds the address for a view", () => {
    expect(viewQuery({ mode: "all" }, { period: "p1" })).toBe("period=p1&view=all");
    expect(viewQuery({ mode: "range", from: "2026-11-01", to: "2026-11-05" })).toBe("view=range&from=2026-11-01&to=2026-11-05");
  });
});
