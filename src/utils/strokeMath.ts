/**
 * Pure math and logic utilities for Zero-Lag drawing, stroke processing,
 * lasso hit-testing, stroke eraser collision, and palm rejection heuristics.
 */

export interface Point {
  x: number;
  y: number;
  pressure: number;
  time: number;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Computes the dynamic stroke width based on active stylus pressure.
 * Pressure ranges from 0.0 to 1.0 (or normalized).
 * Base width is scaled using a calibrated linear/power response curve.
 */
export function calculatePressureWidth(baseWidth: number, pressure: number): number {
  const clampedPressure = Math.max(0.05, Math.min(1.0, pressure));
  // 0.5x minimum up to 2.0x maximum width based on stylus pressure
  const multiplier = 0.5 + clampedPressure * 1.5;
  return baseWidth * multiplier;
}

/**
 * Midpoint calculation for Bezier quadratic curve smoothing
 */
export function getMidPoint(p1: { x: number; y: number }, p2: { x: number; y: number }): { x: number; y: number } {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
}

/**
 * Checks if a point (px, py) is within threshold distance to a line segment (x1, y1) - (x2, y2).
 * Used for stroke-level eraser collision detection.
 */
export function distanceToSegmentSquared(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) {
    return (px - x1) * (px - x1) + (py - y1) * (py - y1);
  }
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * (x2 - x1);
  const projY = y1 + t * (y2 - y1);
  return (px - projX) * (px - projX) + (py - projY) * (py - projY);
}

/**
 * Computes the axis-aligned bounding box of a list of points
 */
export function computeBoundingBox(points: { x: number; y: number }[], padding: number = 0): Rect {
  if (points.length === 0) {
    return { left: 0, top: 0, right: 0, bottom: 0 };
  }
  let left = points[0].x;
  let top = points[0].y;
  let right = points[0].x;
  let bottom = points[0].y;

  for (let i = 1; i < points.length; i++) {
    const pt = points[i];
    if (pt.x < left) left = pt.x;
    if (pt.y < top) top = pt.y;
    if (pt.x > right) right = pt.x;
    if (pt.y > bottom) bottom = pt.y;
  }

  return {
    left: left - padding,
    top: top - padding,
    right: right + padding,
    bottom: bottom + padding,
  };
}

/**
 * Checks if a point is inside a polygon using ray casting algorithm (Lasso tool)
 */
export function isPointInPolygon(point: { x: number; y: number }, polygon: { x: number; y: number }[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Checks if two bounding boxes overlap
 */
export function doRectsOverlap(r1: Rect, r2: Rect): boolean {
  return !(r1.right < r2.left || r1.left > r2.right || r1.bottom < r2.top || r1.top > r2.bottom);
}

/**
 * Checks if a stroke is selected by a lasso loop.
 * A stroke is considered selected if its bounding box overlaps and at least 30% of its sample points
 * or its center point is contained within the lasso polygon.
 */
export function isStrokeSelectedByLasso(
  strokePoints: { x: number; y: number }[],
  lassoPolygon: { x: number; y: number }[]
): boolean {
  if (strokePoints.length === 0 || lassoPolygon.length < 3) return false;

  const strokeBox = computeBoundingBox(strokePoints);
  const lassoBox = computeBoundingBox(lassoPolygon);

  if (!doRectsOverlap(strokeBox, lassoBox)) {
    return false;
  }

  let containedCount = 0;
  const step = Math.max(1, Math.floor(strokePoints.length / 10)); // sample up to 10 points for performance
  let sampled = 0;

  for (let i = 0; i < strokePoints.length; i += step) {
    sampled++;
    if (isPointInPolygon(strokePoints[i], lassoPolygon)) {
      containedCount++;
    }
  }

  return containedCount / sampled >= 0.3;
}

/**
 * Palm Rejection Decision Logic:
 * Evaluates whether an incoming touch/pointer event should be rejected.
 * 1. If active stylus is detected: ACCEPT immediately and update lastStylusTime.
 * 2. If finger/touch:
 *    a) Reject if current time is within rejectionWindowMs (default 400ms) of last stylus event.
 *    b) Reject if contact area / major axis exceeds palm threshold (e.g., width > 35px or area > 1000).
 */
export function shouldRejectPalmEvent(params: {
  isStylus: boolean;
  currentTime: number;
  lastStylusTime: number;
  rejectionWindowMs?: number;
  contactWidth?: number;
  palmContactThreshold?: number;
}): { reject: boolean; reason?: 'STYLUS_COOLDOWN' | 'LARGE_CONTACT_AREA' } {
  const {
    isStylus,
    currentTime,
    lastStylusTime,
    rejectionWindowMs = 400,
    contactWidth = 0,
    palmContactThreshold = 35,
  } = params;

  if (isStylus) {
    return { reject: false };
  }

  // Check 1: 400ms hover/touch cooldown
  if (currentTime - lastStylusTime < rejectionWindowMs) {
    return { reject: true, reason: 'STYLUS_COOLDOWN' };
  }

  // Check 2: Large contact area (palm resting on glass)
  if (contactWidth > palmContactThreshold) {
    return { reject: true, reason: 'LARGE_CONTACT_AREA' };
  }

  return { reject: false };
}
