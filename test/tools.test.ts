import { expect, test } from "bun:test";
import { allTools } from "../src/tools";

test("tool names are unique and prefixed", () => {
  const names = allTools.map((tool) => tool.name);
  expect(new Set(names).size).toBe(names.length);
  for (const name of names) expect(name).toMatch(/^(whm|cpanel)_[a-z0-9_]+$/);
});

test("every cPanel account tool asks for the account", () => {
  for (const tool of allTools.filter((t) => t.name.startsWith("cpanel_"))) {
    expect(Object.keys(tool.input)).toContain("account");
  }
});
