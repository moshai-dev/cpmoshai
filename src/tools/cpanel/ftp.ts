import { z } from "zod";
import { uapiTool } from "../builders";

const user = z.string().min(1).describe("FTP username");

export const ftpTools = [
  uapiTool({
    name: "cpanel_list_ftp_accounts",
    description: "List FTP accounts",
    mode: "read",
    module: "Ftp",
    fn: "list_ftp",
  }),
  uapiTool({
    name: "cpanel_add_ftp_account",
    description: "Create an FTP account",
    mode: "write",
    module: "Ftp",
    fn: "add_ftp",
    input: {
      user,
      pass: z.string().min(1).describe("Password"),
      homedir: z.string().optional().describe("Directory relative to the home directory"),
      quota: z.number().int().min(0).optional().describe("Quota in MB, 0 is unlimited"),
      domain: z.string().optional(),
    },
  }),
  uapiTool({
    name: "cpanel_set_ftp_password",
    description: "Change the password of an FTP account",
    mode: "write",
    module: "Ftp",
    fn: "passwd",
    input: { user, pass: z.string().min(1).describe("New password") },
  }),
  uapiTool({
    name: "cpanel_delete_ftp_account",
    description: "Delete an FTP account",
    mode: "critical",
    module: "Ftp",
    fn: "delete_ftp",
    input: { user, destroy: z.boolean().optional().describe("Also delete its home directory") },
  }),
];
