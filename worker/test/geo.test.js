import { test } from "node:test";
import assert from "node:assert/strict";
import { distanceMeters, bearingDegrees } from "../src/geo.js";

test("distanceMeters: 同じ地点なら距離は0", () => {
  const d = distanceMeters(35.681236, 139.767125, 35.681236, 139.767125);
  assert.equal(Math.round(d), 0);
});

test("distanceMeters: 東京駅-渋谷駅は約6.4km", () => {
  const d = distanceMeters(35.681236, 139.767125, 35.658034, 139.701636);
  assert.ok(d > 6000 && d < 6800, `expected ~6-6.8km, got ${d}`);
});

test("distanceMeters: 緯度1度分はおよそ111.32km", () => {
  const d = distanceMeters(35.0, 139.0, 36.0, 139.0);
  assert.ok(Math.abs(d - 111320) < 1000, `expected ~111320m, got ${d}`);
});

test("bearingDegrees: 真北はおよそ0度", () => {
  const b = bearingDegrees(35.0, 139.0, 35.01, 139.0);
  assert.ok(b < 1 || b > 359, `expected ~0deg, got ${b}`);
});

test("bearingDegrees: 真東はおよそ90度", () => {
  const b = bearingDegrees(35.0, 139.0, 35.0, 139.01);
  assert.ok(Math.abs(b - 90) < 1, `expected ~90deg, got ${b}`);
});

test("bearingDegrees: 真南はおよそ180度", () => {
  const b = bearingDegrees(35.0, 139.0, 34.99, 139.0);
  assert.ok(Math.abs(b - 180) < 1, `expected ~180deg, got ${b}`);
});

test("bearingDegrees: 真西はおよそ270度", () => {
  const b = bearingDegrees(35.0, 139.0, 35.0, 138.99);
  assert.ok(Math.abs(b - 270) < 1, `expected ~270deg, got ${b}`);
});
