import { z } from "zod";
import { whmTool } from "../builders";

const user = z.string().min(1).describe("cPanel account username");
const domain = z.string().min(1).describe("Domain name");

export const accountTools = [
  whmTool({
    name: "whm_list_accounts",
    description: "List cPanel accounts on the server, optionally filtered",
    mode: "read",
    fn: "listaccts",
    input: {
      search: z.string().optional().describe("Search term"),
      searchtype: z.enum(["domain", "owner", "user", "ip", "package"]).optional(),
    },
  }),
  whmTool({
    name: "whm_account_summary",
    description: "Show the summary of one cPanel account",
    mode: "read",
    fn: "accountsummary",
    input: { user },
  }),
  whmTool({
    name: "whm_create_account",
    description: "Create a new cPanel account",
    mode: "write",
    fn: "createacct",
    input: {
      username: z.string().min(1).max(16),
      domain,
      password: z.string().min(1),
      plan: z.string().optional().describe("Hosting package name"),
      contactemail: z.string().email().optional(),
    },
  }),
  whmTool({
    name: "whm_modify_account",
    description: "Modify a cPanel account's username, owner, DNS setting or contact email",
    mode: "write",
    fn: "modifyacct",
    input: {
      user,
      newuser: z.string().min(1).max(16).optional(),
      owner: z.string().optional(),
      DNS: z.string().optional().describe("Main domain"),
      contactemail: z.string().email().optional(),
    },
  }),
  whmTool({
    name: "whm_suspend_account",
    description: "Suspend a cPanel account",
    mode: "critical",
    fn: "suspendacct",
    input: { user, reason: z.string().optional() },
  }),
  whmTool({
    name: "whm_unsuspend_account",
    description: "Unsuspend a cPanel account",
    mode: "write",
    fn: "unsuspendacct",
    input: { user },
  }),
  whmTool({
    name: "whm_remove_account",
    description: "Permanently terminate a cPanel account and delete its data",
    mode: "critical",
    fn: "removeacct",
    input: { user, keepdns: z.boolean().optional().describe("Keep the DNS zones") },
  }),
  whmTool({
    name: "whm_change_package",
    description: "Move a cPanel account to a different hosting package",
    mode: "write",
    fn: "changepackage",
    input: { user, pkg: z.string().min(1).describe("Package name") },
  }),
  whmTool({
    name: "whm_change_password",
    description: "Change the password of a cPanel account",
    mode: "critical",
    fn: "passwd",
    input: { user, password: z.string().min(1) },
  }),
  whmTool({
    name: "whm_set_bandwidth_limit",
    description: "Set the monthly bandwidth limit of an account in MB (0 is unlimited)",
    mode: "write",
    fn: "limitbw",
    input: { user, bwlimit: z.number().int().min(0) },
  }),
  whmTool({
    name: "whm_get_domain_owner",
    description: "Find which account owns a domain",
    mode: "read",
    fn: "getdomainowner",
    input: { domain },
  }),
  whmTool({
    name: "whm_get_domain_user_data",
    description: "Show the web server configuration data of a domain",
    mode: "read",
    fn: "domainuserdata",
    input: { domain },
  }),
  whmTool({
    name: "whm_create_user_session",
    description: "Create a one-time login URL for an account's cPanel, Webmail or WHM",
    mode: "critical",
    fn: "create_user_session",
    input: {
      user,
      service: z.enum(["cpaneld", "webmaild", "whostmgrd"]).default("cpaneld"),
    },
  }),
];
