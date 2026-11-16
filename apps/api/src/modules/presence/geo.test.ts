import { expect, test } from "bun:test";
import { distanceMeters } from "./geo";

test("distance is zero for the same point and about 111 m per 0.001 degree of latitude", () => {
  const p = { lat: -6.2, lng: 106.8 };
  expect(distanceMeters(p, p)).toBe(0);
  expect(Math.round(distanceMeters(p, { lat: -6.201, lng: 106.8 }))).toBeGreaterThan(110);
  expect(Math.round(distanceMeters(p, { lat: -6.201, lng: 106.8 }))).toBeLessThan(112);
  expect(Math.round(distanceMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }) / 1000)).toBe(111); // one degree of longitude on the equator
});
