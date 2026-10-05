import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { activeRoot } from '../runtime/activation.mjs';

let input = '';
for await (const chunk of process.stdin) input += chunk;
const request = JSON.parse(input);
if (typeof request.cwd !== 'string' || request.cwd.length === 0) {
  throw new TypeError('Projector hook input requires a nonempty cwd string.');
}
const event = request.hook_event_name ?? request.event;
if (event !== 'SessionStart' && event !== 'UserPromptSubmit') {
  throw new TypeError('Projector hook input requires SessionStart or UserPromptSubmit.');
}
const root = await activeRoot(request.cwd);
if (root) {
  // Full guidance belongs at session start/resume/compaction. Prompt hooks still
  // check activation, including a plugin enabled after the session began.
  const guidance = event === 'SessionStart'
    ? await fs.readFile(new URL('../AGENTS.md', import.meta.url), 'utf8')
    : `Use the Projector consumer guidance already loaded in this session. If it is not loaded, read ${JSON.stringify(fileURLToPath(new URL('../AGENTS.md', import.meta.url)))} before Projector work. Recheck this project's .projector/active marker before using Projector; ordinary native work does not require its helpers.`;
  const additionalContext = [
    `Projector is active for project root: ${JSON.stringify(root)}.`,
    guidance,
  ].join('\n\n');
  process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext } })}\n`);
}
