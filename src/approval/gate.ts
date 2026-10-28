import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { failure, success } from "../result";
import type { ApprovalStore } from "./store";

export interface ApprovalGate {
  request(tool: string, args: Record<string, unknown>): CallToolResult;
  status(id: string): CallToolResult;
}

const text = (value: string): CallToolResult => ({ content: [{ type: "text", text: value }] });

export function createGate(store: ApprovalStore, keyId: string): ApprovalGate {
  return {
    request(tool, args) {
      const action = store.create(tool, args, keyId);
      return text(
        `Human approval is required before "${tool}" runs. Approval id: ${action.id}, valid until ${action.expiresAt}. ` +
          `An administrator must approve it on the server with: cpmoshai approve ${action.id}. ` +
          `The 2FA code is entered only there and is never shared with you, so do not ask for it. ` +
          `Afterwards call approval_status with this id to get the result.`,
      );
    },
    status(id) {
      const action = store.get(id);
      if (!action || action.keyId !== keyId) return failure(new Error(`No approval ${id}`));
      const state = store.state(action);
      if (state === "pending") return text(`Approval ${id} is still waiting for a human.`);
      if (state === "expired") return failure(new Error(`Approval ${id} expired without a decision`));
      if (state === "denied") return failure(new Error(`Approval ${id} was denied by an administrator`));
      return action.error ? failure(new Error(action.error)) : success(action.result ?? null);
    },
  };
}
