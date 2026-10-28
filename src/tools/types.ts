import type { z } from "zod";
import type { CpanelClient } from "../client";

export type Shape = z.ZodRawShape;

export type Mode = "read" | "write" | "destroy";

export interface ToolDefinition<S extends Shape = Shape> {
  name: string;
  description: string;
  mode: Mode;
  input: S;
  run(args: z.infer<z.ZodObject<S>>, client: CpanelClient): Promise<unknown>;
}
