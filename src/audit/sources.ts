import { z } from "zod";

const TTL_MS = 12 * 3_600_000;
const TIMEOUT_MS = 8_000;

const flagOrDate = z.union([z.string(), z.boolean()]);

const cyclesSchema = z.array(
  z.object({
    cycle: z.string(),
    eol: flagOrDate,
    support: flagOrDate.optional(),
    latest: z.string(),
  }),
);

const tiersSchema = z.object({
  tiers: z.record(
    z.string(),
    z.array(
      z.object({
        build: z.string(),
        expires: z.number().optional(),
        is_lts: z.number().optional(),
        is_main: z.number().optional(),
        named: z.array(z.string()).optional(),
      }),
    ),
  ),
});

export type Cycles = z.infer<typeof cyclesSchema>;
export type Tiers = z.infer<typeof tiersSchema>["tiers"];

const cache = new Map<string, { at: number; value: unknown }>();

async function cached<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${new URL(url).host} answered HTTP ${response.status}`);
  const value = schema.parse(await response.json());
  cache.set(url, { at: Date.now(), value });
  return value;
}

export const lifecycleCycles = (product: string): Promise<Cycles> =>
  cached(`https://endoflife.date/api/${product}.json`, cyclesSchema);

export const cpanelTiers = async (): Promise<Tiers> =>
  (await cached("https://httpupdate.cpanel.net/cpanelsync/TIERS.json", tiersSchema)).tiers;
