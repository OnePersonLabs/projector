import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const source = fileURLToPath(new URL("./windows-job-supervisor.ps1", import.meta.url));
const target = fileURLToPath(new URL("../packages/runtime/dist/execution/windows-job-supervisor.ps1", import.meta.url));
await mkdir(dirname(target), { recursive: true });
await copyFile(source, target);
