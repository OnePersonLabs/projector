import { copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname,"..");
const target = resolve(root,"dist/code-intelligence/semanticdb/generated");
mkdirSync(target,{recursive:true});
for (const name of ["semanticdb.js","semanticdb.d.ts"]) copyFileSync(resolve(root,"src/code-intelligence/semanticdb/generated",name),resolve(target,name));
copyFileSync(resolve(root,"src/code-intelligence/semanticdb/schema/UPSTREAM-LICENSE.md"),resolve(target,"UPSTREAM-LICENSE.md"));
