// Conservative table geometry: only axis-aligned, painted PDF lines/rectangles.
// Unsupported curves, operators or oversized pages produce no inferred cells.
export type Cell = [number, number, number, number]; // displayed page points
type Matrix = [number, number, number, number, number, number];
type Segment = { pos: number; start: number; end: number };
const identity = (): Matrix => [1, 0, 0, 1, 0, 0];
function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
function numbers(value: unknown): number[] | undefined {
  if (!Array.isArray(value) && !ArrayBuffer.isView(value)) return;
  const values = Array.from(value as ArrayLike<number>);
  if (values.length > 10000 || !values.every(Number.isFinite)) return;
  return values;
}
function merge(input: Segment[]): Segment[] {
  const result: Segment[] = [];
  for (const line of input.sort((a, b) => a.pos - b.pos || a.start - b.start)) {
    const same = result.filter(
      (s) => Math.abs(s.pos - line.pos) < 0.8 && s.start <= line.end + 1 && s.end >= line.start - 1,
    );
    if (!same.length) {
      result.push({ ...line });
      continue;
    }
    const first = same[0];
    first.start = Math.min(line.start, ...same.map((s) => s.start));
    first.end = Math.max(line.end, ...same.map((s) => s.end));
    for (const other of same.slice(1)) result.splice(result.indexOf(other), 1);
  }
  return result;
}
export function tableCells(
  list: { fnArray: number[]; argsArray: unknown[] },
  ops: Record<string, number>,
  viewportPoint: (x: number, y: number) => number[],
): Cell[] {
  if (list.fnArray.length > 100000) return [];
  let pathValues = 0;
  let matrix = identity();
  const stack: Matrix[] = [];
  const horizontal: Segment[] = [],
    vertical: Segment[] = [];
  const point = (x: number, y: number) =>
    viewportPoint(
      matrix[0] * x + matrix[2] * y + matrix[4],
      matrix[1] * x + matrix[3] * y + matrix[5],
    );
  const add = (a: number[], b: number[]) => {
    if (Math.abs(a[1] - b[1]) < 0.02 && Math.abs(a[0] - b[0]) >= 8)
      horizontal.push({
        pos: (a[1] + b[1]) / 2,
        start: Math.min(a[0], b[0]),
        end: Math.max(a[0], b[0]),
      });
    else if (Math.abs(a[0] - b[0]) < 0.02 && Math.abs(a[1] - b[1]) >= 8)
      vertical.push({
        pos: (a[0] + b[0]) / 2,
        start: Math.min(a[1], b[1]),
        end: Math.max(a[1], b[1]),
      });
  };
  for (let i = 0; i < list.fnArray.length; i++) {
    const op = list.fnArray[i],
      args = list.argsArray[i];
    if (op === ops.save || op === ops.paintFormXObjectBegin) {
      stack.push([...matrix]);
      if (op === ops.paintFormXObjectBegin && Array.isArray(args)) {
        const m = numbers(args[0]);
        if (m?.length === 6) matrix = multiply(matrix, m as Matrix);
      }
      continue;
    }
    if (op === ops.restore || op === ops.paintFormXObjectEnd) {
      matrix = stack.pop() ?? identity();
      continue;
    }
    if (op === ops.transform) {
      const m = numbers(args);
      if (m?.length === 6) matrix = multiply(matrix, m as Matrix);
      continue;
    }
    if (op !== ops.constructPath || !Array.isArray(args) || !Array.isArray(args[1])) continue;
    const paint = args[0],
      stroke = [ops.stroke, ops.closeStroke].includes(paint),
      fill = [ops.fill, ops.eoFill].includes(paint);
    if (!stroke && !fill) continue;
    for (const raw of args[1]) {
      const path = numbers(raw);
      if (!path) continue;
      pathValues += path.length;
      if (pathValues > 100000) return [];
      const points: number[][] = [];
      let valid = true,
        closed = false;
      for (let j = 0; j < path.length;) {
        const command = path[j++];
        if (command === 4) {
          closed = true;
          continue;
        }
        if (
          (command !== 0 && command !== 1) ||
          j + 1 >= path.length ||
          (command === 0 && points.length)
        ) {
          valid = false;
          break;
        }
        points.push(point(path[j++], path[j++]));
      }
      if (!valid || points.length < 2) continue;
      if (stroke) {
        for (let j = 1; j < points.length; j++) add(points[j - 1], points[j]);
        if (closed) add(points.at(-1)!, points[0]);
      } else if (closed && points.length === 4) {
        // Do not treat arbitrary filled polygons as ruling lines.
        if (
          points.some((p, j) => {
            const q = points[(j + 1) % 4];
            return Math.abs(p[0] - q[0]) > 0.02 && Math.abs(p[1] - q[1]) > 0.02;
          })
        )
          continue;
        const x0 = Math.min(...points.map((p) => p[0])),
          x1 = Math.max(...points.map((p) => p[0])),
          y0 = Math.min(...points.map((p) => p[1])),
          y1 = Math.max(...points.map((p) => p[1]));
        if (y1 - y0 <= 1.5) add([x0, (y0 + y1) / 2], [x1, (y0 + y1) / 2]);
        else if (x1 - x0 <= 1.5) add([(x0 + x1) / 2, y0], [(x0 + x1) / 2, y1]);
      }
    }
    if (horizontal.length + vertical.length > 2000) return [];
  }
  const hs = merge(horizontal).sort((a, b) => a.pos - b.pos),
    vs = merge(vertical).sort((a, b) => a.pos - b.pos),
    cells: Cell[] = [];
  if (hs.length > 120 || vs.length > 120) return [];
  const covers = (line: Segment, from: number, to: number) =>
    line.start <= from + 1 && line.end >= to - 1;
  for (const top of hs) {
    for (const bottom of hs) {
      const height = bottom.pos - top.pos;
      if (height < 8 || height > 80) continue;
      // Adjacent complete rules only: never combine two rows into one cell.
      const sides = vs.filter(
        (v) =>
          covers(v, top.pos, bottom.pos) &&
          covers(top, v.pos, v.pos) &&
          covers(bottom, v.pos, v.pos),
      );
      for (let j = 1; j < sides.length; j++) {
        const left = sides[j - 1].pos,
          right = sides[j].pos;
        if (
          right - left < 20 ||
          right - left > 500 ||
          !covers(top, left, right) ||
          !covers(bottom, left, right)
        )
          continue;
        if (hs.some((h) => h.pos > top.pos + 1 && h.pos < bottom.pos - 1 && covers(h, left, right)))
          continue;
        cells.push([left, top.pos, right, bottom.pos]);
        if (cells.length > 2000) return [];
      }
    }
  }
  return cells;
}
