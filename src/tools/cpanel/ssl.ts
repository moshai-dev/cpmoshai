import { z } from "zod";
import { uapiTool } from "../builders";

export const sslTools = [
  uapiTool({
    name: "cpanel_list_ssl_certs",
    description: "List the account's SSL certificates",
    mode: "read",
    module: "SSL",
    fn: "list_certs",
  }),
  uapiTool({
    name: "cpanel_install_ssl",
    description: "Install an SSL certificate on a domain of the account",
    mode: "write",
    module: "SSL",
    fn: "install_ssl",
    input: {
      domain: z.string().min(1),
      cert: z.string().min(1).describe("PEM certificate"),
      key: z.string().min(1).describe("PEM private key"),
      cabundle: z.string().optional().describe("PEM CA bundle"),
    },
  }),
  uapiTool({
    name: "cpanel_delete_ssl_cert",
    description: "Delete an SSL certificate from the account",
    mode: "critical",
    module: "SSL",
    fn: "delete_cert",
    input: { id: z.string().min(1).describe("Certificate id from cpanel_list_ssl_certs") },
  }),
];
