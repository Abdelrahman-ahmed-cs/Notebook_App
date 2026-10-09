// Ink engine: turns pointer samples into variable-width strokes (perfect-freehand),
// recognises held shapes, and supports whole-stroke and partial erasing.
import { getStroke } from '../vendor/perfect-freehand.js';

const { fabric } = window;

export const PEN_TYPES = {
  fountain: { label: 'Fountain pen', thinning: 0.65, smoothing: 0.6, streamline: 0.5, taperStart: 12, taperEnd: 18, opacity: 1 },
  ballpoint: { label: 'Ballpoint', thinning: 0.18, smoothing: 0.55, streamline: 0.45, taperStart: 0, taperEnd: 0, opacity: 1 },
  brush: { label: 'Brush pen', thinning: 0.85, smoothing: 0.7, streamline: 0.5, taperStart: 30, taperEnd: 40, opacity: 1 },
  pencil: { label: 'Pencil', thinning: 0.3, smoothing: 0.4, streamline: 0.35, taperStart: 4, taperEnd: 4, opacity: 0.82 },
  highlighter: { label: 'Highlighter', thinning: 0, smoothing: 0.6, streamline: 0.6, taperStart: 0, taperEnd: 0, opacity: 0.38 },
};

/** Options passed to perfect-freehand for a pen config. */
export function strokeOptions(pen, { isPen = false, last = true } = {}) {
  const sim = isPen ? false : pen.simulatePressure !== false;
  return {
    size: pen.size,
    thinning: pen.thinning,
    smoothing: pen.smoothing,
    streamline: pen.streamline,
    simulatePressure: sim,
    start: { taper: pen.taperStart || 0, cap: true },
    end: { taper: pen.taperEnd || 0, cap: true },
    last,
  };
}

const avg = (a, b) => (a + b) / 2;

/** Closed SVG path (quadratic smoothing) from perfect-freehand outline points. */
export function outlineToPath(points) {
  const len = points.length;
  if (len < 4) return '';
  let a = points[0];
  let b = points[1];
  const c = points[2];
  let d = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(2)},${b[1].toFixed(2)} ${avg(b[0], c[0]).toFixed(2)},${avg(b[1], c[1]).toFixed(2)} T`;
  for (let i = 2, max = len - 1; i < max; i++) {
    a = points[i];
    b = points[i + 1];
    d += `${avg(a[0], b[0]).toFixed(2)},${avg(a[1], b[1]).toFixed(2)} `;
  }
  return d + 'Z';
}

export function strokePath(points, pen, opts) {
  return outlineToPath(getStroke(points, strokeOptions(pen, opts)));
}

const round1 = (n) => Math.round(n * 10) / 10;

/** Build a fabric.Path for an ink stroke drawn in page coordinates. */
export function makeInkObject(points, pen, isPen) {
  const d = strokePath(points, pen, { isPen });
  if (!d) return null;
  const path = new fabric.Path(d, {
    fill: pen.color,
    stroke: null,
    strokeWidth: 0,
    opacity: pen.opacity,
    globalCompositeOperation: pen.type === 'highlighter' ? 'multiply' : 'source-over',
    objectCaching: true,
    perPixelTargetFind: true,
    lockScalingFlip: true,
  });
  path.set({
    isInk: true,
    inkType: pen.type,
    inkPen: { ...pen },
    inkIsPen: !!isPen,
    inkPoints: points.map((p) => [round1(p[0]), round1(p[1]), Math.round((p[2] ?? 0.5) * 100) / 100]),
  });
  return path;
}

// ---------- geometry helpers ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function pathLength(pts) {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += dist(pts[i - 1], pts[i]);
  return l;
}

function perpDist(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
}

/** Ramer–Douglas–Peucker simplification. */
function rdp(pts, eps) {
  if (pts.length < 3) return pts.slice();
  let maxD = 0;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDist(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD > eps) {
    const l = rdp(pts.slice(0, idx + 1), eps);
    const r = rdp(pts.slice(idx), eps);
    return l.slice(0, -1).concat(r);
  }
  return [pts[0], pts[pts.length - 1]];
}

function densify(corners, step = 4) {
  const out = [];
  for (let i = 0; i < corners.length - 1; i++) {
    const a = corners[i];
    const b = corners[i + 1];
    const n = Math.max(1, Math.round(dist(a, b) / step));
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n, 0.5]);
  }
  out.push([...corners[corners.length - 1].slice(0, 2), 0.5]);
  return out;
}

/**
 * Shape recognition for "draw and hold": returns clean points (line, triangle,
 * rectangle, ellipse) or null when the stroke doesn't resemble a shape.
 */
export function recognizeShape(raw) {
  const pts = raw.map((p) => [p[0], p[1]]);
  if (pts.length < 6) return null;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const diag = Math.hypot(maxX - minX, maxY - minY);
  if (diag < 12) return null;
  const len = pathLength(pts);
  const start = pts[0];
  const end = pts[pts.length - 1];

  if (dist(start, end) / len > 0.92) return { kind: 'line', points: densify([start, end]) };

  const closed = dist(start, end) < diag * 0.22;
  if (!closed) return null;

  const simplified = rdp(pts, diag * 0.09);
  let corners = simplified.slice();
  if (corners.length > 2 && dist(corners[0], corners[corners.length - 1]) < diag * 0.22) corners.pop();

  if (corners.length === 3) {
    return { kind: 'triangle', points: densify([...corners, corners[0]]) };
  }
  if (corners.length === 4) {
    // Snap to an axis-aligned rectangle when the sides are roughly horizontal/vertical.
    const r = [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY], [minX, minY]];
    return { kind: 'rectangle', points: densify(r) };
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, rx = (maxX - minX) / 2, ry = (maxY - minY) / 2;
  const n = 72;
  const ell = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2 - Math.PI / 2;
    ell.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t), 0.5]);
  }
  return { kind: 'ellipse', points: ell };
}

// ---------- erasing ----------

/** Canvas point -> the ink's original drawing space. */
function toInkSpace(obj, p) {
  const inv = fabric.util.invertTransform(obj.calcTransformMatrix());
  const local = fabric.util.transformPoint(new fabric.Point(p.x, p.y), inv);
  return [local.x + obj.pathOffset.x, local.y + obj.pathOffset.y];
}

/** True when a circle (page coords) touches an ink object. */
export function inkHit(obj, p, radius) {
  if (!obj.isInk || !obj.inkPoints) return false;
  const br = obj.getBoundingRect(true, true);
  if (p.x < br.left - radius || p.x > br.left + br.width + radius || p.y < br.top - radius || p.y > br.top + br.height + radius) return false;
  const q = toInkSpace(obj, p);
  const scale = Math.max(Math.abs(obj.scaleX), Math.abs(obj.scaleY)) || 1;
  const r = radius / scale + (obj.inkPen?.size || 4) / 2;
  const pts = obj.inkPoints;
  if (pts.length === 1) return dist(pts[0], q) <= r;
  for (let i = 1; i < pts.length; i++) {
    if (segDist(q, pts[i - 1], pts[i]) <= r) return true;
  }
  return false;
}

function segDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/**
 * Partial erase: removes the points under the eraser and returns replacement
 * stroke objects (possibly empty) with the original transform preserved, or
 * null when nothing was erased.
 */
export function splitInk(obj, p, radius) {
  const q = toInkSpace(obj, p);
  const scale = Math.max(Math.abs(obj.scaleX), Math.abs(obj.scaleY)) || 1;
  const r = radius / scale;
  const pieces = [];
  let cur = [];
  let erased = false;
  for (const pt of obj.inkPoints) {
    if (dist(pt, q) <= r) {
      erased = true;
      if (cur.length) pieces.push(cur);
      cur = [];
    } else {
      cur.push(pt);
    }
  }
  if (cur.length) pieces.push(cur);
  if (!erased) return null;

  const M = obj.calcTransformMatrix();
  const result = [];
  for (const piece of pieces) {
    if (piece.length < 2) continue;
    const pen = { ...obj.inkPen, taperStart: 0, taperEnd: 0 };
    const n = makeInkObject(piece, pen, obj.inkIsPen);
    if (!n) continue;
    n.inkPen = { ...obj.inkPen };
    const T = [1, 0, 0, 1, n.pathOffset.x - obj.pathOffset.x, n.pathOffset.y - obj.pathOffset.y];
    fabric.util.applyTransformToObject(n, fabric.util.multiplyTransformMatrices(M, T));
    n.set({ opacity: obj.opacity, fill: obj.fill });
    result.push(n);
  }
  return result;
}

/** Point-in-polygon (ray casting); poly is an array of {x,y}. */
export function pointInPolygon(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    if ((yi > pt.y) !== (yj > pt.y) && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Sample points (page coords) used by the lasso to decide whether an object is enclosed. */
export function samplePoints(obj) {
  if (obj.isInk && obj.inkPoints?.length) {
    const M = obj.calcTransformMatrix();
    const step = Math.max(1, Math.floor(obj.inkPoints.length / 24));
    const out = [];
    for (let i = 0; i < obj.inkPoints.length; i += step) {
      const ip = obj.inkPoints[i];
      out.push(fabric.util.transformPoint(new fabric.Point(ip[0] - obj.pathOffset.x, ip[1] - obj.pathOffset.y), M));
    }
    return out;
  }
  const c = obj.getCoords(true, true);
  return [...c, obj.getCenterPoint()];
}

/** Rebuild an ink stroke with changed pen settings (e.g. thickness), keeping its transform. */
export function restyleInk(obj, patch) {
  if (!obj.inkPoints?.length) return null;
  const pen = { ...obj.inkPen, ...patch };
  const n = makeInkObject(obj.inkPoints, pen, obj.inkIsPen);
  if (!n) return null;
  const M = obj.calcTransformMatrix();
  const T = [1, 0, 0, 1, n.pathOffset.x - obj.pathOffset.x, n.pathOffset.y - obj.pathOffset.y];
  fabric.util.applyTransformToObject(n, fabric.util.multiplyTransformMatrices(M, T));
  n.set({ opacity: obj.opacity, fill: obj.fill, id: obj.id, audioRef: obj.audioRef, globalCompositeOperation: obj.globalCompositeOperation });
  return n;
}
