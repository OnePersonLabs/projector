import { create, toBinary } from "@bufbuild/protobuf";
import { DocumentSchema, IndexSchema, MetadataSchema, OccurrenceSchema, PositionEncoding, SingleLineRangeSchema, SymbolInformationSchema, SymbolRole } from "@scip-code/scip";
import { describe, expect, it } from "vitest";
import { codeInputHash } from "./input-binding.js";
import { importScip } from "./scip-import.js";

describe("SCIP import", () => {
  it("decodes generated-schema occurrences and keeps calls unavailable", async () => {
    const content = "function greet() {}\ngreet();\n", path = "src/main.ts", symbol = "scip npm demo 1 greet().";
    const document = create(DocumentSchema,{relativePath:path,text:content,positionEncoding:PositionEncoding.UTF16CodeUnitOffsetFromLineStart,symbols:[create(SymbolInformationSchema,{symbol,displayName:"greet"})],occurrences:[create(OccurrenceSchema,{range:[0,9,14],symbol,symbolRoles:SymbolRole.Definition}),create(OccurrenceSchema,{typedRange:{case:"singleLineRange",value:create(SingleLineRangeSchema,{line:1,startCharacter:0,endCharacter:5})},symbol})]});
    const bytes = toBinary(IndexSchema,create(IndexSchema,{metadata:create(MetadataSchema,{projectRoot:"file:///demo"}),documents:[document]}));
    const result = await importScip(bytes,{inputs:[{path,content}],binding:{checkoutId:"test",worktreeDigest:"tree",projectKey:"demo"},artifact:"code.scip",sourceHashes:{[path]:codeInputHash(content)}});
    const staged = new Map<string, (typeof result.partitions)[number]>();
    const streamed = await importScip(bytes,{inputs:[{path,content}],binding:{checkoutId:"test",worktreeDigest:"tree",projectKey:"demo"},artifact:"code.scip",sourceHashes:{[path]:codeInputHash(content)},emitPartition: partition => { staged.set(partition.path, partition); },getPartition: key => staged.get(key)});
    expect({ ...streamed, partitions: [...staged.values()] }).toEqual(result);
    expect(result.binding.status).toBe("verified");
    await expect(importScip(bytes,{inputs:[{path,content}],binding:{checkoutId:"test",worktreeDigest:"tree",projectKey:"demo"},artifact:"code.scip",sourceHashes:{[path]:codeInputHash(content)},maxArtifactBytes:bytes.length-1})).rejects.toThrow(/maxArtifactBytes/);
    await expect(importScip(bytes,{inputs:[{path,content}],binding:{checkoutId:"test",worktreeDigest:"tree",projectKey:"demo"},artifact:"code.scip",sourceHashes:{[path]:codeInputHash(content)},maxArtifactBytes:bytes.length+1,maxFrameBytes:1})).rejects.toThrow(/maxFrameBytes/);
    expect((await importScip(bytes,{inputs:[{path,content}],binding:{checkoutId:"test",worktreeDigest:"tree",projectKey:"demo"},artifact:"code.scip",sourceHashes:{[path]:codeInputHash(content)},maxArtifactBytes:bytes.length+1,maxFrameBytes:bytes.length+1})).binding.status).toBe("verified");
    expect(result.partitions[0]?.symbols).toEqual(expect.arrayContaining([expect.objectContaining({name:"greet"})]));
    expect(result.partitions[0]?.edges).toEqual(expect.arrayContaining([expect.objectContaining({kind:"reference",resolution:"resolved"})]));
    expect(result.partitions[0]?.coverage.capabilities.find(capability => capability.kind === "call")?.status).toBe("unavailable");
    const unobserved = await importScip(bytes,{inputs:[],binding:{checkoutId:"test",worktreeDigest:"tree",projectKey:"demo"},artifact:"code.scip",sourceHashes:{[path]:codeInputHash(content)}});
    expect(unobserved.binding.status).toBe("unbound");
  });
  it("rejects oversized framed documents", async () => {
    const bytes = new Uint8Array([0x12,0x80,0x80,0x80,0x08]);
    await expect(importScip(bytes,{inputs:[],binding:{checkoutId:"test",worktreeDigest:"tree",projectKey:"demo"},artifact:"bad.scip",maxArtifactBytes:128,maxFrameBytes:32})).rejects.toThrow(/frame exceeds maxFrameBytes/i);
  });
});
