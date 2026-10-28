import { z } from "zod";
import { whmTool } from "../builders";

const restartableServices = [
  "httpd",
  "exim",
  "dovecot",
  "named",
  "mysql",
  "ftpd",
  "cpsrvd",
  "cphulkd",
  "queueprocd",
  "cpanellogd",
  "spamd",
] as const;

export const serverTools = [
  whmTool({
    name: "whm_version",
    description: "Show the installed cPanel & WHM version",
    mode: "read",
    fn: "version",
  }),
  whmTool({
    name: "whm_hostname",
    description: "Show the server hostname",
    mode: "read",
    fn: "gethostname",
  }),
  whmTool({
    name: "whm_load_average",
    description: "Show the server load average",
    mode: "read",
    fn: "loadavg",
  }),
  whmTool({
    name: "whm_list_ips",
    description: "List the IP addresses configured on the server",
    mode: "read",
    fn: "listips",
  }),
  whmTool({
    name: "whm_get_tweak_setting",
    description: "Read a WHM Tweak Settings value",
    mode: "read",
    fn: "get_tweaksetting",
    input: {
      key: z.string().min(1),
      module: z.string().optional().describe("Tweak Settings module, defaults to Main"),
    },
  }),
  whmTool({
    name: "whm_php_installed_versions",
    description: "List the PHP versions installed through EasyApache",
    mode: "read",
    fn: "php_get_installed_versions",
  }),
  whmTool({
    name: "whm_php_vhost_versions",
    description: "List the PHP version used by each virtual host",
    mode: "read",
    fn: "php_get_vhost_versions",
  }),
  whmTool({
    name: "whm_php_set_vhost_version",
    description: "Set the PHP version of a virtual host",
    mode: "write",
    fn: "php_set_vhost_versions",
    input: {
      vhost: z.string().min(1).describe("Domain of the virtual host"),
      version: z.string().regex(/^ea-php\d+$/).describe("e.g. ea-php83"),
    },
  }),
  whmTool({
    name: "whm_service_status",
    description: "Show whether server services are running",
    mode: "read",
    fn: "servicestatus",
    input: { service: z.string().optional().describe("One service, e.g. httpd") },
  }),
  whmTool({
    name: "whm_restart_service",
    description: "Restart one of the allowlisted server services",
    mode: "write",
    fn: "restartservice",
    input: { service: z.enum(restartableServices) },
  }),
];
