import type { Graph } from "./graph-layout.js";
import { graphEdgePath } from "./graph-layout.js";
import { pathSegments, sliceSegment, type Segment } from "./geometry.ts";

export interface GraphRail extends Segment { slot: number; synthetic: boolean }
export function graphRowMetrics(index: number, rowHeight: number, expandedRow: number, expandedHeight: number) {
  return { top: index * rowHeight + (expandedRow >= 0 && index > expandedRow ? expandedHeight : 0),
    height: rowHeight + (index === expandedRow ? expandedHeight : 0) };
}
export function graphRails(graph: Graph, rowHeight: number, expandedRow: number, expandedHeight: number): GraphRail[][] {
  const sourceRow = 26;
  const scale = rowHeight / sourceRow;
  const extra = expandedRow >= 0 ? expandedHeight / scale : 0;
  const offsets = graph.rows.map((_, index) => index > expandedRow && expandedRow >= 0 ? extra : 0);
  const buckets: GraphRail[][] = graph.rows.map(() => []);
  const accordionTop = (expandedRow + 1) * rowHeight;
  const rowAt = (y: number) => expandedRow < 0 || y < accordionTop ? Math.floor(y / rowHeight)
    : y < accordionTop + expandedHeight ? expandedRow : Math.floor((y - expandedHeight) / rowHeight);
  for (const edge of graph.edges) {
    for (const source of pathSegments(graphEdgePath(edge, graph.rows.length, offsets, extra))) {
      const segment = { ...source, y1: source.y1 * scale, y2: source.y2 * scale };
      const first = Math.max(0, rowAt(segment.y1));
      const last = Math.min(graph.rows.length - 1, rowAt(segment.y2));
      for (let index = first; index <= last; index++) {
        const { top, height } = graphRowMetrics(index, rowHeight, expandedRow, expandedHeight);
        const clipped = sliceSegment(segment, top, top + height);
        if (clipped) buckets[index].push({ ...clipped, slot: edge.slot, synthetic: graph.rows[edge.from.row].commit.synthetic === true });
      }
    }
  }
  return buckets;
}
