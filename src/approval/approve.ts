import { z } from "zod";
import type { CpanelClient } from "../client";
import type { ToolDefinition } from "../tools/types";
import type { TotpGuard } from "./guard";
import type { ApprovalStore, PendingAction } from "./store";

export type ApproveOutcome =
  | "approved"
  | "invalid-code"
  | "locked"
  | "not-pending"
  | "unknown-tool"
  | "invalid-arguments";

interface Dependencies {
  store: ApprovalStore;
  guard: TotpGuard;
  client: CpanelClient;
  tools: readonly ToolDefinition[];
}

export async function approve(
  { store, guard, client, tools }: Dependencies,
  id: string,
  code: string,
): Promise<{ outcome: ApproveOutcome; action?: PendingAction }> {
  const action = store.get(id);
  if (!action || store.state(action) !== "pending") return { outcome: "not-pending" };

  const tool = tools.find((candidate) => candidate.name === action.tool && candidate.mode === "critical");
  if (!tool) return { outcome: "unknown-tool", action };
  const args = z.object(tool.input).safeParse(action.args);
  if (!args.success) return { outcome: "invalid-arguments", action };

  const verdict = guard.verify(code);
  if (verdict !== "ok") return { outcome: verdict === "locked" ? "locked" : "invalid-code", action };

  try {
    const result = await tool.run(args.data, client);
    return { outcome: "approved", action: store.decide(id, { status: "approved", result }) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { outcome: "approved", action: store.decide(id, { status: "approved", error: message }) };
  }
}
