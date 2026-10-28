import { z } from "zod";
import { uapiTool } from "../builders";

const name = z.string().min(1).describe("Name including the account prefix");
const user = z.string().min(1).describe("Database user including the account prefix");
const database = z.string().min(1).describe("Database name including the account prefix");

export const databaseTools = [
  uapiTool({
    name: "cpanel_list_databases",
    description: "List MySQL databases",
    mode: "read",
    module: "Mysql",
    fn: "list_databases",
  }),
  uapiTool({
    name: "cpanel_create_database",
    description: "Create a MySQL database",
    mode: "write",
    module: "Mysql",
    fn: "create_database",
    input: { name },
  }),
  uapiTool({
    name: "cpanel_delete_database",
    description: "Delete a MySQL database and all of its data",
    mode: "destroy",
    module: "Mysql",
    fn: "delete_database",
    input: { name },
  }),
  uapiTool({
    name: "cpanel_list_database_users",
    description: "List MySQL users",
    mode: "read",
    module: "Mysql",
    fn: "list_users",
  }),
  uapiTool({
    name: "cpanel_create_database_user",
    description: "Create a MySQL user",
    mode: "write",
    module: "Mysql",
    fn: "create_user",
    input: { name, password: z.string().min(1) },
  }),
  uapiTool({
    name: "cpanel_delete_database_user",
    description: "Delete a MySQL user",
    mode: "destroy",
    module: "Mysql",
    fn: "delete_user",
    input: { name },
  }),
  uapiTool({
    name: "cpanel_set_database_user_password",
    description: "Change the password of a MySQL user",
    mode: "write",
    module: "Mysql",
    fn: "set_password",
    input: { user, password: z.string().min(1) },
  }),
  uapiTool({
    name: "cpanel_grant_database_access",
    description: "Grant a MySQL user privileges on a database",
    mode: "write",
    module: "Mysql",
    fn: "set_privileges_on_database",
    input: {
      user,
      database,
      privileges: z.string().default("ALL PRIVILEGES").describe("Comma-separated privileges"),
    },
  }),
  uapiTool({
    name: "cpanel_revoke_database_access",
    description: "Revoke all privileges of a MySQL user on a database",
    mode: "destroy",
    module: "Mysql",
    fn: "revoke_access_to_database",
    input: { user, database },
  }),
];
