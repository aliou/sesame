import type { ExtensionAPI, ToolDefinition } from "@mariozechner/pi-coding-agent";

import { createSesameSearchTool } from "./tools/sesame-search";

export default function (pi: ExtensionAPI) {
  pi.registerTool(createSesameSearchTool(pi) as ToolDefinition);
}
