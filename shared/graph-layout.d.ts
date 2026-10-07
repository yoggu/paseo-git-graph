import type { Commit } from "./rpc";
export interface Point { row: number; column: number }
export interface Edge { from: Point; to: Point | null; column: number; slot: number; main: boolean; parent: string }
export interface Graph { rows: { commit: Commit; column: number; slot: number }[]; edges: Edge[]; columnCount: number }
export function layout(commits: Commit[], hasMore: boolean): Graph;
export function graphEdgePath(edge: Edge, rowCount: number, offsets?: number[], extraHeight?: number): string;
