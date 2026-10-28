import { accountTools } from "./accounts";
import { backupTools } from "./backups";
import { dnsTools } from "./dns";
import { packageTools } from "./packages";
import { resellerTools } from "./resellers";
import { serverTools } from "./server";
import { sslTools } from "./ssl";

export const whmTools = [
  ...accountTools,
  ...packageTools,
  ...dnsTools,
  ...serverTools,
  ...sslTools,
  ...resellerTools,
  ...backupTools,
];
