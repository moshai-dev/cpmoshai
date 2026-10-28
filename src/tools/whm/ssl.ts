import { z } from "zod";
import { whmTool } from "../builders";

export const sslTools = [
  whmTool({
    name: "whm_list_ssl_certs",
    description: "List the SSL certificates installed on the server",
    mode: "read",
    fn: "listcrts",
  }),
  whmTool({
    name: "whm_get_ssl_info",
    description: "Show the SSL certificate installed for a domain",
    mode: "read",
    fn: "fetchsslinfo",
    input: { domain: z.string().min(1) },
  }),
  whmTool({
    name: "whm_install_ssl",
    description: "Install an SSL certificate on a domain",
    mode: "write",
    fn: "installssl",
    input: {
      domain: z.string().min(1),
      crt: z.string().min(1).describe("PEM certificate"),
      key: z.string().min(1).describe("PEM private key"),
      cab: z.string().optional().describe("PEM CA bundle"),
      ip: z.string().optional().describe("Dedicated IP address"),
    },
  }),
  whmTool({
    name: "whm_autossl_check_user",
    description: "Start an AutoSSL check for one account",
    mode: "write",
    fn: "start_autossl_check_for_one_user",
    input: { username: z.string().min(1) },
  }),
  whmTool({
    name: "whm_autossl_check_all",
    description: "Start an AutoSSL check for every account",
    mode: "write",
    fn: "start_autossl_check_for_all_users",
  }),
];
