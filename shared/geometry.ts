export interface Segment { x1: number; y1: number; x2: number; y2: number }

export function pathSegments(path: string): Segment[] {
  const tokens = path.match(/[MCL]|-?\d+(?:\.\d+)?/g) ?? [];
  const segments: Segment[] = [];
  let i = 0, x = 0, y = 0;
  while (i < tokens.length) {
    const command = tokens[i++];
    if (command === "M") { x = Number(tokens[i++]); y = Number(tokens[i++]); }
    else if (command === "L") {
      const nx = Number(tokens[i++]), ny = Number(tokens[i++]);
      segments.push({ x1: x, y1: y, x2: nx, y2: ny }); x = nx; y = ny;
    } else if (command === "C") {
      const cx1 = Number(tokens[i++]), cy1 = Number(tokens[i++]);
      const cx2 = Number(tokens[i++]), cy2 = Number(tokens[i++]);
      const nx = Number(tokens[i++]), ny = Number(tokens[i++]);
      const sx = x, sy = y;
      for (let step = 1; step <= 10; step++) {
        const t = step / 10, u = 1 - t;
        const px = u ** 3 * sx + 3 * u ** 2 * t * cx1 + 3 * u * t ** 2 * cx2 + t ** 3 * nx;
        const py = u ** 3 * sy + 3 * u ** 2 * t * cy1 + 3 * u * t ** 2 * cy2 + t ** 3 * ny;
        segments.push({ x1: x, y1: y, x2: px, y2: py }); x = px; y = py;
      }
    } else throw new Error("Unsupported graph path command");
  }
  return segments;
}

export function sliceSegment(segment: Segment, top: number, bottom: number): Segment | null {
  if (segment.y2 <= top || segment.y1 >= bottom) return null;
  const height = segment.y2 - segment.y1;
  if (height <= 0) return null;
  const from = Math.max(0, (top - segment.y1) / height), to = Math.min(1, (bottom - segment.y1) / height);
  const x = (t: number) => segment.x1 + t * (segment.x2 - segment.x1);
  const y = (t: number) => segment.y1 + t * height - top;
  return { x1: x(from), y1: y(from), x2: x(to), y2: y(to) };
}
