import { z } from "zod";
import { uapiTool } from "../builders";

export const accountInfoTools = [
  uapiTool({
    name: "cpanel_user_information",
    description: "Show the account's profile, plan and limits",
    mode: "read",
    module: "Variables",
    fn: "get_user_information",
  }),
  uapiTool({
    name: "cpanel_quota",
    description: "Show the account's disk quota and usage",
    mode: "read",
    module: "Quota",
    fn: "get_quota_info",
  }),
  uapiTool({
    name: "cpanel_resource_usage",
    description: "Show the account's resource usage against its limits",
    mode: "read",
    module: "ResourceUsage",
    fn: "get_usages",
  }),
  uapiTool({
    name: "cpanel_stats",
    description: "Show account statistics such as disk and bandwidth usage",
    mode: "read",
    module: "StatsBar",
    fn: "get_stats",
    input: { display: z.string().min(1).describe("Stat names separated by |, e.g. diskusage|bandwidthusage") },
  }),
  uapiTool({
    name: "cpanel_list_domains",
    description: "List the main, addon, parked and sub domains of the account",
    mode: "read",
    module: "DomainInfo",
    fn: "list_domains",
  }),
  uapiTool({
    name: "cpanel_domains_data",
    description: "Show document roots and settings of every domain of the account",
    mode: "read",
    module: "DomainInfo",
    fn: "domains_data",
  }),
  uapiTool({
    name: "cpanel_domain_data",
    description: "Show document root and settings of one domain",
    mode: "read",
    module: "DomainInfo",
    fn: "single_domain_data",
    input: { domain: z.string().min(1) },
  }),
];
