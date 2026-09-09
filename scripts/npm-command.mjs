import { access } from "node:fs/promises";
import { delimiter, dirname, join } from "node:path";

export async function resolveNpmCommand(arguments_, environment = process.env) {
  if (process.platform !== "win32") return { executable: "npm", arguments: arguments_ };

  const pathValue = Object.entries(environment).find(([key]) => key.toLowerCase() === "path")?.[1] ?? "";
  const configuredNpm = environment.npm_execpath;
  const candidates = [
    ...(configuredNpm !== undefined && /(?:^|[\\/])npm-cli\.js$/iu.test(configuredNpm) ? [configuredNpm] : []),
    join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
    ...pathValue.split(delimiter).filter(Boolean).map((entry) => join(entry, "node_modules", "npm", "bin", "npm-cli.js")),
  ];
  for (const candidate of new Set(candidates)) {
    try {
      await access(candidate);
      return { executable: process.execPath, arguments: [candidate, ...arguments_] };
    } catch (error) {
      if ((error)?.code !== "ENOENT") throw error;
    }
  }
  throw new Error("npm-cli.js was not found beside the active Node installation or an npm PATH entry");
}
