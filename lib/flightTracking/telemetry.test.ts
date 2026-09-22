import { describe, expect, it } from "vitest";
import {
  compassDirection,
  formatDurationShort,
  formatSecondsAgo,
  haversineDistanceNm,
  trackDistanceNm,
  verticalRateStatus,
} from "./telemetry";

describe("haversineDistanceNm", () => {
  it("returns 0 for identical points", () => {
    expect(haversineDistanceNm({ lat: 51.47, lon: -0.4614 }, { lat: 51.47, lon: -0.4614 })).toBe(0);
  });

  it("returns roughly the known great-circle distance between LHR and JFK", () => {
    const lhr = { lat: 51.4706, lon: -0.4619 };
    const jfk = { lat: 40.6413, lon: -73.7781 };

    expect(haversineDistanceNm(lhr, jfk)).toBeCloseTo(2991, -1);
  });
});

describe("trackDistanceNm", () => {
  it("sums consecutive point-to-point distances", () => {
    const a = { lat: 51.4706, lon: -0.4619 };
    const b = { lat: 52, lon: -0.4619 };
    const c = { lat: 52, lon: 1 };

    const total = trackDistanceNm([
      { ...a, timestamp: "", alt: 0, gspeed: 0, vspeed: 0, track: 0, squawk: "", callsign: null, source: "" },
      { ...b, timestamp: "", alt: 0, gspeed: 0, vspeed: 0, track: 0, squawk: "", callsign: null, source: "" },
      { ...c, timestamp: "", alt: 0, gspeed: 0, vspeed: 0, track: 0, squawk: "", callsign: null, source: "" },
    ]);

    expect(total).toBeCloseTo(haversineDistanceNm(a, b) + haversineDistanceNm(b, c));
  });

  it("returns 0 for a single point or empty track", () => {
    expect(trackDistanceNm([])).toBe(0);
    expect(
      trackDistanceNm([
        { lat: 0, lon: 0, timestamp: "", alt: 0, gspeed: 0, vspeed: 0, track: 0, squawk: "", callsign: null, source: "" },
      ]),
    ).toBe(0);
  });
});

describe("compassDirection", () => {
  it.each([
    [0, "N"],
    [44, "NE"],
    [90, "E"],
    [135, "SE"],
    [180, "S"],
    [225, "SW"],
    [270, "W"],
    [315, "NW"],
    [359, "N"],
  ])("maps heading %d degrees to %s", (heading, expected) => {
    expect(compassDirection(heading)).toBe(expected);
  });

  it("normalizes negative headings", () => {
    expect(compassDirection(-90)).toBe("W");
  });
});

describe("verticalRateStatus", () => {
  it("returns climbing above the level threshold", () => {
    expect(verticalRateStatus(1200)).toBe("climbing");
  });

  it("returns descending below the negative level threshold", () => {
    expect(verticalRateStatus(-1200)).toBe("descending");
  });

  it("returns level within the threshold band", () => {
    expect(verticalRateStatus(0)).toBe("level");
    expect(verticalRateStatus(100)).toBe("level");
    expect(verticalRateStatus(-100)).toBe("level");
  });
});

describe("formatDurationShort", () => {
  it("formats sub-hour durations as minutes only", () => {
    expect(formatDurationShort(42 * 60_000)).toBe("42m");
  });

  it("formats multi-hour durations as hours and minutes", () => {
    expect(formatDurationShort((3 * 60 + 42) * 60_000)).toBe("3h 42m");
  });

  it("clamps negative durations to 0m", () => {
    expect(formatDurationShort(-5000)).toBe("0m");
  });
});

describe("formatSecondsAgo", () => {
  it("formats sub-minute durations in seconds", () => {
    expect(formatSecondsAgo(12_000)).toBe("12s ago");
  });

  it("formats durations of a minute or more using formatDurationShort", () => {
    expect(formatSecondsAgo(90_000)).toBe("2m ago");
  });
});
