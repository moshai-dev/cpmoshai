import { BlockList, isIP } from "node:net";

function normalise(address: string): string {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  return mapped?.[1] ?? address;
}

export function clientIp(headers: Headers): string | null {
  const last = headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return last && isIP(last) ? normalise(last) : null;
}

export function createIpAllowlist(cidrs: readonly string[]): (ip: string) => boolean {
  if (cidrs.length === 0) return () => true;
  const list = new BlockList();
  for (const cidr of cidrs) {
    const [address = "", prefix] = cidr.split("/");
    const family = isIP(address);
    if (!family) throw new Error(`Invalid allowed IP: ${cidr}`);
    const type = family === 4 ? "ipv4" : "ipv6";
    if (prefix === undefined) list.addAddress(address, type);
    else list.addSubnet(address, Number(prefix), type);
  }
  return (ip) => list.check(ip, isIP(ip) === 4 ? "ipv4" : "ipv6");
}
