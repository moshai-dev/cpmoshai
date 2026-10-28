import { z } from "zod";
import { whmTool } from "../builders";

const domain = z.string().min(1).describe("Zone domain name");
const line = z.number().int().min(1).describe("Zone file line number from whm_get_dns_zone");

const recordFields = {
  name: z.string().min(1).describe("Record name, e.g. www.example.com."),
  type: z.enum(["A", "AAAA", "CNAME", "MX", "TXT"]),
  ttl: z.number().int().min(0).optional(),
  address: z.string().optional().describe("Value for A and AAAA"),
  cname: z.string().optional().describe("Value for CNAME"),
  exchange: z.string().optional().describe("Mail host for MX"),
  preference: z.number().int().min(0).optional().describe("Priority for MX"),
  txtdata: z.string().optional().describe("Value for TXT"),
};

export const dnsTools = [
  whmTool({
    name: "whm_list_dns_zones",
    description: "List DNS zones on the server",
    mode: "read",
    fn: "listzones",
    input: { domain: z.string().optional().describe("Only zones matching this domain") },
  }),
  whmTool({
    name: "whm_get_dns_zone",
    description: "Show every record of a DNS zone with line numbers",
    mode: "read",
    fn: "dumpzone",
    input: { domain },
  }),
  whmTool({
    name: "whm_add_dns_zone",
    description: "Create a DNS zone",
    mode: "write",
    fn: "adddns",
    input: { domain, ip: z.string().min(1).describe("Server IP address") },
  }),
  whmTool({
    name: "whm_delete_dns_zone",
    description: "Delete a DNS zone",
    mode: "critical",
    fn: "killdns",
    input: { domain },
  }),
  whmTool({
    name: "whm_reset_dns_zone",
    description: "Reset a DNS zone to the server defaults, discarding custom records",
    mode: "critical",
    fn: "resetzone",
    input: { domain },
  }),
  whmTool({
    name: "whm_add_dns_record",
    description: "Add a record to a DNS zone",
    mode: "write",
    fn: "addzonerecord",
    input: { domain, ...recordFields },
  }),
  whmTool({
    name: "whm_edit_dns_record",
    description: "Replace a record of a DNS zone",
    mode: "write",
    fn: "editzonerecord",
    input: { domain, line, ...recordFields },
  }),
  whmTool({
    name: "whm_remove_dns_record",
    description: "Remove a record from a DNS zone",
    mode: "critical",
    fn: "removezonerecord",
    input: { zone: domain, line },
  }),
];
