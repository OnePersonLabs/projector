import { hashFramedDomain, type ProjectionUnit, type SelectorExpr } from "@projector/core";
import { projectionUnitSelectorSubject, type SelectorSubject } from "@projector/engine";
import type { LocalRepositoryAnalysis } from "@projector/analyzers";
import type { IndexedObservationDelta, SqliteObservationStore } from "@projector/runtime";
import type { IndexedObservationDescriptor } from "../observation/indexed-types.js";
import type { RepositoryObservationData } from "../observation/tasks.js";

type Gate = { field: string; mode: "value" | "prefix" | "suffix"; value: unknown };
const key = (gate: Gate): string => `realization-incidence:${hashFramedDomain("realization-incidence-gate/v1", gate)}`;
const unknownKey = (field: string): string => `realization-incidence-unknown:${field}`;
const supportedFields = new Set(["path", "artifact-role", "concept", "requirement", "scenario", "lens", "tag", "control-ownership", "control-mutation", "causal-origin", "surface", "package", "package-kind"]);

/** Necessary positive conditions only. Undefined means the selector can match
 * without any safe addressed gate and must remain a conservative candidate. */
export function realizationSelectorGates(selector: SelectorExpr): readonly Gate[] | undefined {
  if (selector.op === "not") return undefined;
  if (selector.op === "all") {
    const choices = selector.items.map(realizationSelectorGates).filter((value): value is readonly Gate[] => value !== undefined);
    return choices.sort((a,b) => a.length-b.length)[0];
  }
  if (selector.op === "any") {
    const choices = selector.items.map(realizationSelectorGates);
    return choices.some(value => value === undefined) ? undefined : choices.flatMap(value => value!);
  }
  if (!supportedFields.has(selector.field)) return undefined;
  if (selector.matcher === "equals" && typeof selector.value === "string") return [{field:selector.field,mode:"value",value:selector.value}];
  if (selector.matcher === "in" && Array.isArray(selector.value) && selector.value.every(value => typeof value === "string")) return selector.value.map(value => ({field:selector.field,mode:"value",value}));
  if (selector.field === "path" && selector.matcher === "glob" && typeof selector.value === "string") {
    // Restrict optimization to simple canonical globs. Other valid patterns are
    // retained in the conservative population rather than interpreted here.
    if (!/^[A-Za-z0-9_./:*?-]+$/.test(selector.value)) return undefined;
    const prefix = selector.value.match(/^([A-Za-z0-9_.\/:-]+)[*?]/)?.[1];
    if (prefix !== undefined) return [{field:"path",mode:"prefix",value:prefix}];
    const suffix = selector.value.match(/[*?]([A-Za-z0-9_.\/:-]+)$/)?.[1];
    // A globstar directory can consume zero directories. Its following slash
    // is therefore not a necessary suffix character (for example **/new.mjs).
    if (suffix !== undefined) return [{field:"path",mode:"suffix",value:suffix.replace(/^\/+/, "")}];
    if (!/[*?]/.test(selector.value)) return [{field:"path",mode:"value",value:selector.value}];
  }
  return undefined;
}

export function enrollRealizationIncidence(observation: RepositoryObservationData): IndexedObservationDelta {
  const members = new Map<string,Set<string>>();
  const add = (selector:string,id:string):void => {const ids=members.get(selector)??new Set<string>();ids.add(id);members.set(selector,ids);};
  for (const document of observation.canonical.documents) {
    if (!["concept","requirement","behavioral-scenario"].includes(document.kind)) continue;
    const payload = document.payload as {status?:string;realizations?:readonly {selector:SelectorExpr}[]};
    if (payload.status !== "active") continue;
    for (const binding of payload.realizations??[]) {
      const gates=realizationSelectorGates(binding.selector);
      if(gates===undefined)add("realization-incidence:conservative",document.id);
      else for(const gate of gates){add(key(gate),document.id);add(unknownKey(gate.field),document.id);}
    }
  }
  return {upserts:[{kind:"population-version",key:"realization-incidence",value:hashFramedDomain("realization-incidence/v1",observation.canonical.rootDigest)}],populations:[...members].flatMap(([selector,ids])=>[...ids].map(member=>({selector,member,present:true})))};
}

export function safeRealizationCandidateIds(input:{descriptor:IndexedObservationDescriptor;store:SqliteObservationStore;analysis:LocalRepositoryAnalysis;changedPaths:readonly string[]}):string[] {
  const {descriptor,store,analysis}=input,generation=descriptor.generation;
  if(store.getAt(generation,"population-version","realization-incidence")===undefined)throw new Error("Realization incidence index is missing; rebuild the complete observation");
  const ids=new Set(store.populationAt(generation,"realization-incidence:conservative"));
  const add=(selector:string):void=>{for(const id of store.populationAt(generation,selector))ids.add(id);};
  const files=new Map(analysis.files.map(file=>[file.artifactId,file]));
  for(const original of analysis.projectionUnits){
    const unit={...original,conceptIds:[],requirementIds:[],scenarioIds:[]} as ProjectionUnit;
    const path=files.get(unit.artifactId)?.path??unit.key,segments=path.split("/"),packageRoot=["packages","apps"].includes(segments[0]!)&&segments[1]!==undefined?`${segments[0]}/${segments[1]}`:undefined;
    const subject:SelectorSubject=projectionUnitSelectorSubject(unit,{path,surface:analysis.surface.kind,...(packageRoot===undefined?{}:{package:packageRoot,packageKind:segments[0]})});
    for(const field of supportedFields){
      const value=subject.values[field as keyof typeof subject.values];
      if(value===undefined){add(unknownKey(field));continue;}
      for(const item of Array.isArray(value)?value:[value])add(key({field,mode:"value",value:item}));
    }
    // Prefix and suffix keys are addressed by the changed path, with no scan of
    // registered patterns. Cost is bounded by path length, not selector count.
    for(let length=1;length<=path.length;length++){add(key({field:"path",mode:"prefix",value:path.slice(0,length)}));add(key({field:"path",mode:"suffix",value:path.slice(-length)}));}
  }
  for(const path of new Set([...input.changedPaths,...analysis.files.map(file=>file.path)]))for(const unitId of store.populationAt(generation,`unit-path:${path}`)){
    const unit=store.getAt<ProjectionUnit>(generation,"unit",unitId);
    if(unit===undefined)throw new Error(`Realization incidence prior unit ${unitId} is missing`);
    for(const id of [...unit.conceptIds,...unit.requirementIds,...unit.scenarioIds])ids.add(id);
  }
  return [...ids].sort();
}
