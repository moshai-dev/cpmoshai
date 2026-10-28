import { auditTools } from "./audit";
import { cpanelTools } from "./cpanel";
import { rawTools } from "./raw";
import { systemTools } from "./system";
import type { ToolDefinition } from "./types";
import { whmTools } from "./whm";

export const allTools: ToolDefinition[] = [...whmTools, ...cpanelTools, ...rawTools];

export const remoteTools: ToolDefinition[] = [...allTools, ...systemTools, ...auditTools];
