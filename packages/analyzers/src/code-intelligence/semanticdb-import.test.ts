import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { scala } from "./semanticdb/generated/semanticdb.js";
import { codeInputHash } from "./input-binding.js";
import { importSemanticDb } from "./semanticdb-import.js";

const db = scala.meta.internal.semanticdb;
describe("SemanticDB import", () => {
  it("decodes pinned generated schema and verifies source MD5 and inventory hash", async () => {
    const path = "src/Main.scala", content = "object Main { def greet = 1; greet }\n", symbol = "demo/Main.greet().";
    const document = {schema:db.Schema.SEMANTICDB4,uri:path,text:content,md5:createHash("md5").update(content).digest("hex"),symbols:[{symbol,kind:db.SymbolInformation.Kind.METHOD,displayName:"greet"}],occurrences:[{range:{startLine:0,startCharacter:18,endLine:0,endCharacter:23},symbol,role:db.SymbolOccurrence.Role.DEFINITION},{range:{startLine:0,startCharacter:29,endLine:0,endCharacter:34},symbol,role:db.SymbolOccurrence.Role.REFERENCE}]};
    const bytes = db.TextDocuments.encode({documents:[document]}).finish();
    async function* stream() { yield bytes.subarray(0,7); yield bytes.subarray(7); }
    const snapshot = await importSemanticDb(stream(),{inputs:[{path,content}],binding:{checkoutId:"test",worktreeDigest:"tree",projectKey:"scala"},artifact:"Main.scala.semanticdb",sourceHashes:{[path]:codeInputHash(content)}});
    const staged = new Map<string, (typeof snapshot.partitions)[number]>();
    const streamed = await importSemanticDb(bytes,{inputs:[{path,content}],binding:{checkoutId:"test",worktreeDigest:"tree",projectKey:"scala"},artifact:"Main.scala.semanticdb",sourceHashes:{[path]:codeInputHash(content)},emitPartition: partition => { staged.set(partition.path, partition); },getPartition: key => staged.get(key)});
    expect({ ...streamed, partitions: [...staged.values()] }).toEqual(snapshot);
    expect(snapshot.binding.status).toBe("verified");
    await expect(importSemanticDb(bytes,{inputs:[{path,content}],binding:{checkoutId:"test",worktreeDigest:"tree",projectKey:"scala"},artifact:"Main.scala.semanticdb",sourceHashes:{[path]:codeInputHash(content)},maxArtifactBytes:bytes.length-1})).rejects.toThrow(/maxArtifactBytes/);
    await expect(importSemanticDb(bytes,{inputs:[{path,content}],binding:{checkoutId:"test",worktreeDigest:"tree",projectKey:"scala"},artifact:"Main.scala.semanticdb",sourceHashes:{[path]:codeInputHash(content)},maxArtifactBytes:bytes.length+1,maxFrameBytes:1})).rejects.toThrow(/maxFrameBytes/);
    expect((await importSemanticDb(bytes,{inputs:[{path,content}],binding:{checkoutId:"test",worktreeDigest:"tree",projectKey:"scala"},artifact:"Main.scala.semanticdb",sourceHashes:{[path]:codeInputHash(content)},maxArtifactBytes:bytes.length+1,maxFrameBytes:bytes.length+1})).binding.status).toBe("verified");
    expect(snapshot.partitions[0]?.symbols).toEqual(expect.arrayContaining([expect.objectContaining({name:"greet"})]));
    expect(snapshot.partitions[0]?.edges).toEqual(expect.arrayContaining([expect.objectContaining({kind:"reference",resolution:"resolved"})]));
    expect(snapshot.partitions[0]?.coverage.capabilities.find(capability => capability.kind === "call")?.status).toBe("unavailable");
    const unobserved = await importSemanticDb(bytes,{inputs:[],binding:{checkoutId:"test",worktreeDigest:"tree",projectKey:"scala"},artifact:"Main.scala.semanticdb",sourceHashes:{[path]:codeInputHash(content)}});
    expect(unobserved.binding.status).toBe("unbound");
  });
});
