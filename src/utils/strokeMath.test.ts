import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePressureWidth,
  getMidPoint,
  distanceToSegmentSquared,
  computeBoundingBox,
  isPointInPolygon,
  isStrokeSelectedByLasso,
  shouldRejectPalmEvent,
} from './strokeMath';

test('calculatePressureWidth scales base stroke width proportionally with stylus pressure', () => {
  const base = 10;
  // min clamped pressure (0.05) -> multiplier 0.5 + 0.05 * 1.5 = 0.575 -> 5.75
  const minResult = calculatePressureWidth(base, 0);
  assert.ok(minResult >= 5 && minResult <= 6, `Expected ~5.75, got ${minResult}`);

  // normal pressure (0.5) -> multiplier 0.5 + 0.5 * 1.5 = 1.25 -> 12.5
  const midResult = calculatePressureWidth(base, 0.5);
  assert.equal(midResult, 12.5);

  // max clamped pressure (1.0) -> multiplier 0.5 + 1.0 * 1.5 = 2.0 -> 20.0
  const maxResult = calculatePressureWidth(base, 1.0);
  assert.equal(maxResult, 20);
});

test('getMidPoint calculates center between two 2D points accurately', () => {
  const p1 = { x: 10, y: 20 };
  const p2 = { x: 30, y: 60 };
  const mid = getMidPoint(p1, p2);
  assert.deepEqual(mid, { x: 20, y: 40 });
});

test('distanceToSegmentSquared calculates perpendicular and endpoint distances', () => {
  // Point exactly on the segment
  const distOn = distanceToSegmentSquared(5, 0, 0, 0, 10, 0);
  assert.equal(distOn, 0);

  // Point offset perpendicularly by 3 units
  const distOff = distanceToSegmentSquared(5, 3, 0, 0, 10, 0);
  assert.equal(distOff, 9); // 3^2 = 9

  // Point closest to endpoint (10, 0), test at (14, 3) -> distance is sqrt((14-10)^2 + 3^2) = 5 -> distSquared = 25
  const distPast = distanceToSegmentSquared(14, 3, 0, 0, 10, 0);
  assert.equal(distPast, 25);
});

test('computeBoundingBox produces tight AABB with padding', () => {
  const points = [
    { x: 10, y: 50 },
    { x: 80, y: 20 },
    { x: 40, y: 90 },
  ];
  const box = computeBoundingBox(points, 5);
  assert.equal(box.left, 5); // 10 - 5
  assert.equal(box.top, 15); // 20 - 5
  assert.equal(box.right, 85); // 80 + 5
  assert.equal(box.bottom, 95); // 90 + 5
});

test('isPointInPolygon handles points inside and outside polygon', () => {
  const polygon = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];

  assert.equal(isPointInPolygon({ x: 50, y: 50 }, polygon), true);
  assert.equal(isPointInPolygon({ x: 150, y: 50 }, polygon), false);
  assert.equal(isPointInPolygon({ x: -10, y: 50 }, polygon), false);
});

test('isStrokeSelectedByLasso selects stroke inside lasso loop', () => {
  const lasso = [
    { x: 10, y: 10 },
    { x: 90, y: 10 },
    { x: 90, y: 90 },
    { x: 10, y: 90 },
  ];

  const strokeInside = [
    { x: 30, y: 30 },
    { x: 40, y: 40 },
    { x: 50, y: 50 },
  ];

  const strokeOutside = [
    { x: 150, y: 150 },
    { x: 160, y: 160 },
  ];

  assert.equal(isStrokeSelectedByLasso(strokeInside, lasso), true);
  assert.equal(isStrokeSelectedByLasso(strokeOutside, lasso), false);
});

test('shouldRejectPalmEvent enforces 400ms stylus window and contact area thresholds', () => {
  const baseTime = 1000;

  // 1. Stylus touch is always accepted
  const stylusEvent = shouldRejectPalmEvent({
    isStylus: true,
    currentTime: baseTime + 100,
    lastStylusTime: baseTime,
  });
  assert.equal(stylusEvent.reject, false);

  // 2. Finger touch within 400ms is rejected
  const quickFinger = shouldRejectPalmEvent({
    isStylus: false,
    currentTime: baseTime + 200,
    lastStylusTime: baseTime,
  });
  assert.equal(quickFinger.reject, true);
  assert.equal(quickFinger.reason, 'STYLUS_COOLDOWN');

  // 3. Finger touch after 400ms with normal contact size is accepted
  const validFinger = shouldRejectPalmEvent({
    isStylus: false,
    currentTime: baseTime + 500,
    lastStylusTime: baseTime,
    contactWidth: 15,
  });
  assert.equal(validFinger.reject, false);

  // 4. Large contact area (palm resting on glass > 35px) is rejected even after cooldown
  const palmRest = shouldRejectPalmEvent({
    isStylus: false,
    currentTime: baseTime + 600,
    lastStylusTime: baseTime,
    contactWidth: 65,
  });
  assert.equal(palmRest.reject, true);
  assert.equal(palmRest.reason, 'LARGE_CONTACT_AREA');
});
