import { cpanelTools } from "./cpanel";
import { rawTools } from "./raw";
import type { ToolDefinition } from "./types";
import { whmTools } from "./whm";

export const allTools: ToolDefinition[] = [...whmTools, ...cpanelTools, ...rawTools];
