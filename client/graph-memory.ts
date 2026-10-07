import type { Commit, Target } from "../shared/rpc";
import type { Selection } from "./accordion";

interface GraphMemory {
  target?: Target; repositoryName: string; ref: string | null; search: string;
  selection: Selection | null; compareBase: Commit | null;
}
const memory = new Map<string, GraphMemory>();
export const recallGraph = (workspaceId: string) => memory.get(workspaceId);
export function rememberGraph(workspaceId: string, state: GraphMemory) {
  memory.delete(workspaceId);
  memory.set(workspaceId, state);
  if (memory.size > 256) memory.delete(memory.keys().next().value!);
}
