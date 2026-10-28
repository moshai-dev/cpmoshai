import type { Config } from "./config";

export class CpanelError extends Error {
  override name = "CpanelError";
}

export type ParamValue = string | number | boolean | null | undefined;
export type Params = Record<string, ParamValue>;

interface WhmEnvelope {
  metadata: { result: number; reason?: string };
  data?: unknown;
}

interface UapiResult {
  status: number;
  data: unknown;
  errors: string[] | null;
}

export function toFormBody(params: Params): URLSearchParams {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    body.set(key, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
  }
  return body;
}

export class CpanelClient {
  readonly #config: Config;
  readonly #endpoint: string;

  constructor(config: Config) {
    this.#config = config;
    this.#endpoint = `https://${config.host}:${config.port}/json-api`;
  }

  whm(fn: string, params: Params = {}): Promise<unknown> {
    return this.#call(fn, params);
  }

  async uapi(account: string, module: string, fn: string, params: Params = {}): Promise<unknown> {
    const data = (await this.#call("uapi_cpanel", {
      ...params,
      "cpanel.user": account,
      "cpanel.module": module,
      "cpanel.function": fn,
    })) as { uapi?: UapiResult } | null;
    const result = data?.uapi;
    if (!result) throw new CpanelError(`${module}::${fn} returned no UAPI result`);
    if (result.status !== 1) {
      throw new CpanelError(result.errors?.join("; ") ?? `${module}::${fn} failed`);
    }
    return result.data;
  }

  async #call(fn: string, params: Params): Promise<unknown> {
    const body = toFormBody({ ...params, "api.version": 1 });
    const response = await fetch(`${this.#endpoint}/${fn}`, {
      method: "POST",
      headers: {
        Authorization: `whm ${this.#config.user}:${this.#config.token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(this.#config.timeoutMs),
      tls: { rejectUnauthorized: !this.#config.insecureTls },
    });

    const envelope = (await response.json().catch(() => null)) as WhmEnvelope | null;
    if (!envelope?.metadata) {
      throw new CpanelError(`${fn}: HTTP ${response.status} with an unrecognised response body`);
    }
    if (envelope.metadata.result !== 1) {
      throw new CpanelError(envelope.metadata.reason ?? `${fn} failed`);
    }
    return envelope.data ?? null;
  }
}
