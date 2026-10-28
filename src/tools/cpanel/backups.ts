import { z } from "zod";
import { uapiTool } from "../builders";

export const backupTools = [
  uapiTool({
    name: "cpanel_list_backups",
    description: "List the account's available backups",
    mode: "read",
    module: "Backup",
    fn: "list_backups",
  }),
  uapiTool({
    name: "cpanel_create_backup",
    description: "Start a full account backup into the home directory",
    mode: "write",
    module: "Backup",
    fn: "fullbackup_to_homedir",
    input: { email: z.string().email().optional().describe("Notify this address when done") },
  }),
];
