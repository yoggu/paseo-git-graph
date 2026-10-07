import type { PluginServerContext } from "@getpaseo/plugin/server";
import { requestGit } from "./server/adapter";
import { gitRequest } from "./shared/rpc";

export default function contribute(server: PluginServerContext) {
  server.handle(gitRequest, requestGit);
  return () => {};
}
