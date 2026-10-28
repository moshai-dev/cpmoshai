import { accountInfoTools } from "./account";
import { backupTools } from "./backups";
import { databaseTools } from "./databases";
import { emailTools } from "./email";
import { fileTools } from "./files";
import { ftpTools } from "./ftp";
import { sslTools } from "./ssl";

export const cpanelTools = [
  ...accountInfoTools,
  ...emailTools,
  ...databaseTools,
  ...ftpTools,
  ...fileTools,
  ...sslTools,
  ...backupTools,
];
