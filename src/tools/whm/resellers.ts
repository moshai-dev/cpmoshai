import { z } from "zod";
import { whmTool } from "../builders";

const user = z.string().min(1).describe("Reseller username");

export const resellerTools = [
  whmTool({
    name: "whm_list_resellers",
    description: "List reseller accounts",
    mode: "read",
    fn: "listresellers",
  }),
  whmTool({
    name: "whm_reseller_stats",
    description: "Show resource usage statistics of a reseller",
    mode: "read",
    fn: "resellerstats",
    input: { user },
  }),
  whmTool({
    name: "whm_setup_reseller",
    description: "Give an account reseller privileges",
    mode: "write",
    fn: "setupreseller",
    input: { user, makeowner: z.boolean().optional().describe("Make it its own owner") },
  }),
  whmTool({
    name: "whm_unsetup_reseller",
    description: "Remove reseller privileges from an account",
    mode: "write",
    fn: "unsetupreseller",
    input: { user },
  }),
  whmTool({
    name: "whm_set_reseller_limits",
    description: "Limit the number of accounts a reseller may create",
    mode: "write",
    fn: "setresellerlimits",
    input: {
      user,
      enable_account_limit: z.boolean(),
      account_limit: z.number().int().min(0).optional(),
    },
  }),
];
