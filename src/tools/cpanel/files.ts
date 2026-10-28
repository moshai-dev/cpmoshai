import { z } from "zod";
import { uapiTool } from "../builders";

const dir = z.string().min(1).describe("Directory path, e.g. /home/user/public_html");
const file = z.string().min(1).describe("File name inside the directory");

export const fileTools = [
  uapiTool({
    name: "cpanel_list_files",
    description: "List the files of a directory",
    mode: "read",
    module: "Fileman",
    fn: "list_files",
    input: { dir },
  }),
  uapiTool({
    name: "cpanel_read_file",
    description: "Read a text file",
    mode: "read",
    module: "Fileman",
    fn: "get_file_content",
    input: { dir, file },
  }),
  uapiTool({
    name: "cpanel_write_file",
    description: "Write a text file, replacing existing content",
    mode: "destroy",
    module: "Fileman",
    fn: "save_file_content",
    input: { dir, file, content: z.string() },
  }),
];
