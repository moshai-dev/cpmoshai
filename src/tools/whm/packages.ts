import { z } from "zod";
import { whmTool } from "../builders";

const limit = z.union([z.number().int().min(0), z.literal("unlimited")]);

const packageSettings = {
  quota: limit.optional().describe("Disk quota in MB"),
  bwlimit: limit.optional().describe("Monthly bandwidth in MB"),
  maxftp: limit.optional(),
  maxsql: limit.optional(),
  maxpop: limit.optional(),
  maxsub: limit.optional(),
  maxpark: limit.optional(),
  maxaddon: limit.optional(),
  featurelist: z.string().optional(),
};

const name = z.string().min(1).describe("Package name");

export const packageTools = [
  whmTool({
    name: "whm_list_packages",
    description: "List hosting packages",
    mode: "read",
    fn: "listpkgs",
  }),
  whmTool({
    name: "whm_get_package",
    description: "Show the settings of one hosting package",
    mode: "read",
    fn: "getpkginfo",
    input: { pkg: name },
  }),
  whmTool({
    name: "whm_add_package",
    description: "Create a hosting package",
    mode: "write",
    fn: "addpkg",
    input: { name, ...packageSettings },
  }),
  whmTool({
    name: "whm_edit_package",
    description: "Edit a hosting package",
    mode: "write",
    fn: "editpkg",
    input: { name, ...packageSettings },
  }),
  whmTool({
    name: "whm_delete_package",
    description: "Delete a hosting package",
    mode: "critical",
    fn: "killpkg",
    input: { pkgname: name },
  }),
];
