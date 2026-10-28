import { z } from "zod";
import type { Params } from "../client";
import type { Mode, Shape, ToolDefinition } from "./types";

interface Spec<S extends Shape> {
  name: string;
  description: string;
  mode: Mode;
  input?: S;
}

const accountField = {
  account: z.string().min(1).describe("cPanel account username to run the call as"),
};

export function whmTool<S extends Shape = {}>(
  spec: Spec<S> & { fn: string },
): ToolDefinition<S> {
  return {
    name: spec.name,
    description: spec.description,
    mode: spec.mode,
    input: spec.input ?? ({} as S),
    run: (args, client) => client.whm(spec.fn, args as Params),
  };
}

export function uapiTool<S extends Shape = {}>(
  spec: Spec<S> & { module: string; fn: string },
): ToolDefinition<S & typeof accountField> {
  return {
    name: spec.name,
    description: spec.description,
    mode: spec.mode,
    input: { ...spec.input, ...accountField } as S & typeof accountField,
    run: (args, client) => {
      const { account, ...params } = args as { account: string } & Params;
      return client.uapi(account, spec.module, spec.fn, params);
    },
  };
}
