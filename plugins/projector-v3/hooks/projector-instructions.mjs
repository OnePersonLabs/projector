import { readFile } from "node:fs/promises";

const instructions = new URL("../AGENTS.md", import.meta.url);

try {
  const additionalContext = await readFile(instructions, "utf8");
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext },
  }));
} catch (error) {
  process.stderr.write(`Projector instruction injection failed: cannot read ${instructions.href}: ${error.message}\n`);
  process.exitCode = 1;
}
