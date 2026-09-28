import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname,"..");
const upstream = resolve(root,"src/code-intelligence/semanticdb/schema/semanticdb.proto");
const outputJs = resolve(root,"src/code-intelligence/semanticdb/generated/semanticdb.js");
const outputTypes = resolve(root,"src/code-intelligence/semanticdb/generated/semanticdb.d.ts");
const source = readFileSync(upstream,"utf8");
const scalapbOnly = 'import "scalapb/scalapb.proto";\n\noption (scalapb.options) = {\n  preserve_unknown_fields: false\n};\n';
if (!source.includes(scalapbOnly)) throw new Error("Upstream SemanticDB ScalaPB option block changed; inspect schema before regeneration");
const scratch = mkdtempSync(join(tmpdir(),"projector-semanticdb-"));
try {
  const decoderSchema = join(scratch,"semanticdb.proto");
  writeFileSync(decoderSchema,source.replace(scalapbOnly,""));
  for (const [bin,args] of [
    [require.resolve("protobufjs-cli/bin/pbjs"),["-t","static-module","-w","es6","-o",outputJs,decoderSchema]],
    [require.resolve("protobufjs-cli/bin/pbts"),["-o",outputTypes,outputJs]],
  ]) {
    const result = spawnSync(process.execPath,[bin,...args],{cwd:root,encoding:"utf8"});
    if (result.status !== 0) throw new Error(`${bin} failed: ${result.stderr || result.stdout}`);
  }
  const generated = readFileSync(outputJs,"utf8");
  const esmImport = 'import * as $protobuf from "protobufjs/minimal";';
  if (!generated.includes(esmImport)) throw new Error("protobufjs generated import changed; inspect ESM runtime compatibility");
  writeFileSync(outputJs,generated.replace(esmImport,'import $protobuf from "protobufjs/minimal.js";'));
} finally { rmSync(scratch,{recursive:true,force:true}); }
