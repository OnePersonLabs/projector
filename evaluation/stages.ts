import { createHash } from 'node:crypto';
import type { Trajectory, TrialMode } from './index.ts';

const sha = (source: string) => createHash('sha256').update(source).digest('hex');
const spec = (meaning: string) => `# Playback lifecycle\n\n## Purpose\n\nDefine playback, event provenance, evidence and late-consumer responsibilities.\n\n## Requirements\n\n### Requirement: Playback lifecycle\n${meaning}\n\n#### Scenario: Playback\n- **WHEN** a caller publishes live or preview playback\n- **THEN** events retain their provenance and evidence remains available\n`;
const finalMeaning = 'The runtime SHALL publish live and preview playback through one current route, retain detached event provenance and independently replaceable evidence, and replay retained events once to a late recording consumer before delivering future events. Preview-specific counting, strategy registration and retired history ownership SHALL be removed.';
const design = (mode: TrialMode, trajectory: Trajectory) => `---\nprojectorDesign: 1\nid: playback/events\nscope: src\n---\n# Playback events\n\n## Contract\n\nOwn playback events, provenance, retained evidence and their current consumers.\n\n## Decision: event-owner\n\nChoice: ${mode === 'evolved' ? 'Use the existing preview strategy with retained event ownership.' : 'Use the ordinary runtime event owner.'}\nReason: ${mode === 'evolved' ? 'The accepted preview strategy separates preview publication while the existing runtime retains events and evidence.' : 'The initial runtime publishes events and retains evidence without a separate strategy.'}\nRequires: [[spec:playback/events#Playback lifecycle]]\nRealizes: [[code:src/index.js]]${mode === 'evolved' ? `, [[code:src/preview-strategy.js]], [[code:src/${trajectory === 'ownership' ? 'preview-history' : 'retained-events'}.js]]` : ''}\nEvidence: Exercise playback, provenance and retained evidence through the public runtime.\n`;
export function stageArtifacts(mode: TrialMode, trajectory: Trajectory) {
  const liveDesign = design(mode, trajectory);
  const finalPart = `## Decision: event-owner\n\nChoice: Publish through one current event owner and attach a late recording consumer.\nReason: Playback provenance and independently retained evidence serve surviving playback and late-consumer requirements; preview-specific strategy and counting have no surviving responsibility.\nRequires: [[spec:playback/events#Playback lifecycle]]\nRealizes: [[code:src/index.js]], [[code:src/recorder.js]]\nEvidence: Runtime tests cover live and preview provenance, evidence replacement, late replay and removal of the retired route.\n`;
  const partialPart = `## Decision: event-owner\n\nChoice: Extend the existing preview strategy with previewCount() for the preview audit milestone.\nReason: The intermediate requirement needs an observable preview count while retaining existing event provenance and evidence.\nRequires: [[spec:playback/events#Playback lifecycle]]\nRealizes: [[code:src/index.js]], [[code:src/preview-strategy.js]], [[code:src/${trajectory === 'ownership' ? 'preview-history' : 'retained-events'}.js]]\nEvidence: The stage checkpoint plays live and preview events and verifies previewCount() reports only the preview calls.\n`;
  const delta = (part: string) => `---\ndesignDelta: 1\ntarget: playback/events\nbaseline: ${sha(liveDesign)}\n---\n# Event ownership delta\n\n## Replace: decision:event-owner\n\n\`\`\`markdown\n${part}\`\`\`\n`;
  const requirementDelta = (meaning: string) => `## MODIFIED Requirements\n\n### Requirement: Playback lifecycle\n${meaning}\n\n#### Scenario: Playback\n- **WHEN** a caller publishes live or preview playback\n- **THEN** the current stage contract holds while event provenance and evidence remain correct\n`;
  const prefix = 'openspec/changes/clean-evolution';
  return {
    baseline: {
      '.gitignore': '.worktrees/\n',
      'openspec/specs/playback/events/spec.md': spec(mode === 'evolved' ? 'The runtime SHALL publish preview playback through the accepted PreviewStrategy, retain events with live/preview provenance, and retain independently replaceable evidence.' : 'The runtime SHALL publish playback with live/preview provenance and retain independently replaceable evidence.'),
      'openspec/designs/playback/events/design.md': liveDesign,
    },
    initial: {
      [`${prefix}/.openspec.yaml`]: 'schema: projector\n',
      [`${prefix}/proposal.md`]: '# Clean evolution\n\n## Why\nPlayback event ownership must follow current preview, evidence and late-consumer requirements.\n\n## What Changes\n- Revise the playback lifecycle and its current implementation contributions.\n\n## Capabilities\n### Modified Capabilities\n- playback/events\n\n## Impact\nRuntime event ownership, evidence, preview implementation and the recording consumer.\n',
      [`${prefix}/tasks.md`]: '# Work\n\n- [ ] implementation: Satisfy the reviewed current playback target and account for prior contributions.\n- [ ] evidence: Execute the stage checks and final runtime tests.\n',
      [`${prefix}/specs/playback/events/spec.md`]: requirementDelta(mode === 'evolved' ? 'The runtime SHALL add previewCount() to the existing preview strategy, counting only preview calls while preserving event provenance and independently retained evidence.' : finalMeaning),
      [`${prefix}/designs/playback/events/design.md`]: delta(mode === 'evolved' ? partialPart : finalPart),
    },
    final: {
      [`${prefix}/specs/playback/events/spec.md`]: requirementDelta(finalMeaning),
      [`${prefix}/designs/playback/events/design.md`]: delta(finalPart),
    }
  };
}

export function functionalHistoricalWorld(trajectory: Trajectory): Record<string, string> {
  const file = trajectory === 'ownership' ? 'preview-history' : 'retained-events';
  const type = trajectory === 'ownership' ? 'PreviewHistory' : 'RetainedEvents';
  return {
    [`src/${file}.js`]: `export class ${type} { records=[]; retained=new Map(); append(event){this.records.push({...event});return {...event};} events(){return this.records.map(event=>({...event}));} retain(id,text){this.retained.set(id,text);} evidence(id){return this.retained.get(id)??null;} }\n`,
    'src/preview-strategy.js': 'export class PreviewStrategy { constructor(history){this.history=history;this.previewCalls=[];} publish(id,sequence){this.previewCalls.push(id);return this.history.append({id,sequence,provenance:"preview"});} }\n',
    'src/index.js': `import {${type}} from './${file}.js'; import {PreviewStrategy} from './preview-strategy.js';\nexport function createRuntime(){const history=new ${type}(), strategy=new PreviewStrategy(history);let sequence=0;return {play(id,options={}){return options.preview?strategy.publish(id,++sequence):history.append({id,sequence:++sequence,provenance:'live'});},events(){return history.events();},retain(id,text){history.retain(id,text);},evidence(id){return history.evidence(id);},subscribe(){throw new Error('Late consumer is not implemented yet');}};}\n`
  };
}

export const projectorAdapter = `import {readFile,writeFile,mkdir} from 'node:fs/promises'; import {execFileSync} from 'node:child_process'; import path from 'node:path'; import {pathToFileURL} from 'node:url';
const root=path.resolve(process.env.PROJECTOR_TRIAL_ROOT??'.');const config=JSON.parse(await readFile(path.join(root,'trial.json'),'utf8'));const runtime=process.env.PROJECTOR_EVAL_RUNTIME;
if(!runtime)throw new Error('PROJECTOR_EVAL_RUNTIME must name the installed dist/change/index.js entry');
const {ChangeService}=await import(pathToFileURL(path.resolve(runtime)));const service=new ChangeService();const common={root,change:'clean-evolution'};const command=process.argv[2];const input=process.argv[3]?JSON.parse(process.argv[3]):{};
let result;
if(command==='advance'){
 if(config.mode!=='evolved')throw new Error('Only evolved trials have an intermediate target');
 const state=await service.resumeChange(common);const candidate=String(state.candidateRoot);
 const evidence=await service.recordEvidence({...common,command:process.execPath,args:['--input-type=module','-e',"import assert from 'node:assert/strict';import {createRuntime} from './src/index.js';const r=createRuntime();r.play('live');r.play('preview',{preview:true});r.play('preview2',{preview:true});assert.equal(r.previewCount(),2);assert.deepEqual(r.events().map(e=>e.provenance),['live','preview','preview']);r.retain('proof','kept');assert.equal(r.evidence('proof'),'kept');"],scope:['src/index.js','src/preview-strategy.js']});
 if(!evidence.evidence.passed)throw new Error('Intermediate behavior did not pass; target was not advanced');
 const git=(...args)=>execFileSync('git',['-C',candidate,...args],{encoding:'utf8',windowsHide:true}).trim();git('add','--all');const tree=git('write-tree');const checkpoint=git('-c','user.name=Projector trial','-c','user.email=trial@localhost','commit-tree',tree,'-p','HEAD','-m','Verified intermediate preview audit');git('update-ref','refs/projector/evaluation/intermediate',checkpoint);
 for(const [file,source]of Object.entries(config.finalTarget)){await mkdir(path.dirname(path.join(root,file)),{recursive:true});await writeFile(path.join(root,file),source);}
 result=await service.reviseChange(common);await writeFile(path.join(root,'stage-evidence.json'),JSON.stringify({version:1,checkpoint,priorTarget:state.targetId,nextTarget:result.targetId,evidence:evidence.evidence,trajectory:config.trajectory})+'\\n');
}else{
 const names={prepare:'prepareChange',plan:'validatePlan',apply:'applyChange',evidence:'recordEvidence',revise:'reviseChange',status:'resumeChange'};const name=names[command];if(!name)throw new Error('Use prepare, plan, apply, advance, evidence, revise or status');
 result=await service[name]({...common,...input});
}
console.log(JSON.stringify(result,null,2));
`;
