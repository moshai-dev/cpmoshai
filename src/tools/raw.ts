import { z } from "zod";
import type { Params } from "../client";
import type { ToolDefinition } from "./types";

const identifier = z.string().regex(/^[A-Za-z0-9_]+$/, "letters, digits and underscores only");

const params = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
  .default({})
  .describe("Function arguments");

const whmCall: ToolDefinition<{ function: typeof identifier; params: typeof params }> = {
  name: "whm_call",
  description:
    "Call any WHM API 1 function by name. Use only when no dedicated whm_* tool exists",
  mode: "critical",
  input: { function: identifier, params },
  run: (args, client) => client.whm(args.function, args.params),
};

const uapiCall: ToolDefinition<{
  account: z.ZodString;
  module: typeof identifier;
  function: typeof identifier;
  params: typeof params;
}> = {
  name: "cpanel_uapi_call",
  description:
    "Call any cPanel UAPI function as an account. Use only when no dedicated cpanel_* tool exists",
  mode: "critical",
  input: {
    account: z.string().min(1).describe("cPanel account username to run the call as"),
    module: identifier,
    function: identifier,
    params,
  },
  run: (args, client) =>
    client.uapi(args.account, args.module, args.function, args.params as Params),
};

export const rawTools = [whmCall, uapiCall];
