import { analyzeCollectedLocalRepository, inventoryEntryBytes, type CollectedLocalRepositoryInputs, type InventoryResult } from "@projector/analyzers";
import { buildManifest, manifestKey, type DerivedObservationBudget } from "@projector/core";
import { SqliteObservationStage, parseCanonicalSnapshotSources, type CanonicalSnapshotSource, type ObservationStageDescriptor, type IndexedObservationDelta } from "@projector/runtime";
import type { IndexedObservationMetadata } from "../observation/indexed-types.js";
import type { RepositoryObservationData } from "../observation/tasks.js";
import { KnowledgeGraph } from "../knowledge/graph.js";
import { enrollIndexedGraph } from "../knowledge/indexed-enrollment.js";
import { buildRepositoryImpactSnapshot } from "../impact/service.js";
import { realizeChangeRepositoryData } from "./repository-observer.js";
import { sourceRecords } from "./indexed-source-records.js";
import { hydrateCapturedInventory } from "../observation/source-inventory.js";

export type IndexedColdResult=Pick<IndexedObservationMetadata,"state"|"analysisHeader"|"canonicalRootDigest"|"counts"|"incrementalSupport"|"fileManifestRoot"|"moveManifestRoot">;
export interface IndexedColdInput {
  readonly collected:CollectedLocalRepositoryInputs;
  readonly canonicalSources:readonly CanonicalSnapshotSource[];
  readonly stage:ObservationStageDescriptor;
}
export function summarizeColdObservation(data:RepositoryObservationData,inventory:InventoryResult):{summary:IndexedColdResult;manifestDelta:IndexedObservationDelta}{
  const {surface,capabilities,observationDescriptor,git}=data.analysis;
  const fileManifest=buildManifest(data.analysis.files.map(({path,contentHash,mediaType,generated})=>({key:manifestKey(path),value:{path,contentHash,mediaType,generated}})));
  const moveManifest=buildManifest(data.analysis.gitMoves.map(move=>({key:manifestKey(move.fromPath),value:move})));
  return {
    summary:{state:data.state,analysisHeader:{surface,capabilities,observationDescriptor,git:{availability:git.availability,revision:git.revision}},canonicalRootDigest:data.canonical.rootDigest,
      counts:{files:inventory.entries.length,bytes:inventory.entries.reduce((sum,entry)=>sum+inventoryEntryBytes(entry),0),directories:inventory.directories?.length??0},
      incrementalSupport:{globalSyntax:data.analysis.javaScript.events.length===0&&data.analysis.javaScript.contracts.length===0&&data.analysis.javaScript.eventUncertainties.length===0,hookReachability:!data.analysis.files.some(file=>file.lifecycleExports.length>0||file.semanticRole==="hook-private-support")},
      fileManifestRoot:fileManifest.root,moveManifestRoot:moveManifest.root},
    manifestDelta:{upserts:[...fileManifest.nodes].map(([key,value])=>({kind:"file-manifest",key,value})).concat([...moveManifest.nodes].map(([key,value])=>({kind:"move-manifest",key,value})))},
  };
}
/** Keep compiler facts and graph enrollment in one worker; only immutable stage
 * addresses and the publication summary cross back to the caller. */
export function executeIndexedObservationTask(input:IndexedColdInput,budget:DerivedObservationBudget):IndexedColdResult {
  const hydrated=hydrateCapturedInventory(input.collected.inventoryResult);
  let stage:SqliteObservationStage|undefined;
  try {
    const collected={...input.collected,inventoryResult:hydrated.inventory};
    const data=realizeChangeRepositoryData(collected.options.repositoryRoot,analyzeCollectedLocalRepository(collected,budget),parseCanonicalSnapshotSources(input.canonicalSources,budget),budget);
    stage=new SqliteObservationStage(input.stage,true);
    const sources=sourceRecords(data,hydrated.inventory.entries);
    // The capture owner streams original bytes directly during publication.
    stage.write({...sources,upserts:sources.upserts?.filter(record=>record.kind!=="inventory")??[]});
    const graph=new KnowledgeGraph(data,{},budget);
    enrollIndexedGraph(data,buildRepositoryImpactSnapshot(data,graph),graph,delta=>stage!.write(delta));
    const {summary,manifestDelta}=summarizeColdObservation(data,hydrated.inventory);
    stage.write(manifestDelta);stage.finish();
    return summary;
  } finally {stage?.close();hydrated.close();}
}
