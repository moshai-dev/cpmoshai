import { whmTool } from "../builders";

export const backupTools = [
  whmTool({
    name: "whm_backup_config",
    description: "Show the server backup configuration",
    mode: "read",
    fn: "backup_config_get",
  }),
  whmTool({
    name: "whm_backup_destinations",
    description: "List the configured backup destinations",
    mode: "read",
    fn: "backup_destination_list",
  }),
  whmTool({
    name: "whm_backup_dates",
    description: "List the dates for which backups exist",
    mode: "read",
    fn: "backup_date_list",
  }),
];
