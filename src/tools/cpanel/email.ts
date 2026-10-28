import { z } from "zod";
import { uapiTool } from "../builders";

const domain = z.string().min(1).describe("Mail domain");

export const emailTools = [
  uapiTool({
    name: "cpanel_list_mail_domains",
    description: "List the domains that can host email for the account",
    mode: "read",
    module: "Email",
    fn: "list_mail_domains",
  }),
  uapiTool({
    name: "cpanel_list_email_accounts",
    description: "List the email accounts of the account",
    mode: "read",
    module: "Email",
    fn: "list_pops",
  }),
  uapiTool({
    name: "cpanel_add_email_account",
    description: "Create an email account",
    mode: "write",
    module: "Email",
    fn: "add_pop",
    input: {
      email: z.string().min(1).describe("Local part, before the @"),
      password: z.string().min(1),
      domain,
      quota: z.number().int().min(0).optional().describe("Quota in MB, 0 is unlimited"),
    },
  }),
  uapiTool({
    name: "cpanel_delete_email_account",
    description: "Delete an email account and its mailbox",
    mode: "critical",
    module: "Email",
    fn: "delete_pop",
    input: { email: z.string().min(1).describe("Local part, before the @"), domain },
  }),
  uapiTool({
    name: "cpanel_set_email_password",
    description: "Change the password of an email account",
    mode: "write",
    module: "Email",
    fn: "passwd_pop",
    input: { email: z.string().min(1), password: z.string().min(1), domain },
  }),
  uapiTool({
    name: "cpanel_set_email_quota",
    description: "Change the quota of an email account",
    mode: "write",
    module: "Email",
    fn: "edit_pop_quota",
    input: {
      email: z.string().min(1),
      domain,
      quota: z.number().int().min(0).describe("Quota in MB, 0 is unlimited"),
    },
  }),
  uapiTool({
    name: "cpanel_list_forwarders",
    description: "List email forwarders",
    mode: "read",
    module: "Email",
    fn: "list_forwarders",
    input: { domain: domain.optional() },
  }),
  uapiTool({
    name: "cpanel_add_forwarder",
    description: "Forward an email address to another address",
    mode: "write",
    module: "Email",
    fn: "add_forwarder",
    input: {
      domain,
      email: z.string().min(1).describe("Local part to forward"),
      fwdopt: z.literal("fwd").default("fwd"),
      fwdemail: z.string().email().describe("Destination address"),
    },
  }),
  uapiTool({
    name: "cpanel_delete_forwarder",
    description: "Delete an email forwarder",
    mode: "critical",
    module: "Email",
    fn: "delete_forwarder",
    input: {
      address: z.string().email().describe("Forwarded address"),
      forwarder: z.string().email().describe("Destination address"),
    },
  }),
  uapiTool({
    name: "cpanel_list_autoresponders",
    description: "List autoresponders of a domain",
    mode: "read",
    module: "Email",
    fn: "list_auto_responders",
    input: { domain },
  }),
];
