import type {TerrainLod} from './terrainAssets.js';

// Latest pipeline, four active work records, twelve completed records. No pixel
// buffers, timers, listeners, URLs, game state, or per-slice event log are retained.
type LodState={queuedAt?:number;selectedAt?:number;startedAt?:number;finishedAt?:number;status:string};
interface PipelineState {id:number;running:TerrainLod|null;queued:TerrainLod[];active:boolean;disposed:boolean;ready:TerrainLod[];failed:TerrainLod[];updatedAt:number;lods:Record<TerrainLod,LodState>;}
interface WorkState {id:number;lod:TerrainLod|null;stage:string;state:string;startedAt:number;updatedAt:number;lastAdvancedAt:number;steps:number;yields:number;workMs:number;maxSliceMs:number;}
let generation=0,workId=0,pipeline:PipelineState|null=null;
let camera:Readonly<Record<string,number|string|null>>|null=null;
const active=new Map<number,WorkState>(),recent:WorkState[]=[];
export function createTerrainPipelineDiagnostic(){
  const id=++generation,lods:Record<TerrainLod,LodState>={far:{status:'not-queued'},medium:{status:'not-queued'},close:{status:'not-queued'}};
  return {
    transition(lod:TerrainLod,status:string){const t=performance.now(),s=lods[lod];s.status=status;if(status==='queued')s.queuedAt=t;if(status==='selected')s.selectedAt=t;if(status==='building')s.startedAt=t;if(status==='complete'||status==='failed')s.finishedAt=t;},
    update(value:Omit<PipelineState,'id'|'lods'|'updatedAt'>){if(!pipeline||id>=pipeline.id)pipeline={...value,id,lods,updatedAt:performance.now()};},
  };
}
export function recordTerrainCamera(value:Readonly<Record<string,number|string|null>>){camera={...value};}
export function beginTerrainWorkDiagnostic(stage:string,lod:TerrainLod|null){
  const t=performance.now(),record:WorkState={id:++workId,lod,stage,state:'scheduled',startedAt:t,updatedAt:t,lastAdvancedAt:t,steps:0,yields:0,workMs:0,maxSliceMs:0};
  if(active.size===4)active.delete(active.keys().next().value!);active.set(record.id,record);return record;
}
export function updateTerrainWorkDiagnostic(record:WorkState,state:string,steps:number,yields:number,workMs:number,maxSliceMs:number){
  const t=performance.now();if(steps!==record.steps)record.lastAdvancedAt=t;
  Object.assign(record,{state,steps,yields,workMs,maxSliceMs,updatedAt:t});
}
export function finishTerrainWorkDiagnostic(record:WorkState,success:boolean){
  record.state=success?'complete':'failed-or-cancelled';record.updatedAt=performance.now();active.delete(record.id);
  recent.push({...record});if(recent.length>12)recent.shift();
}
export function terrainBuildDiagnosticReport(){return {version:'STARTUP-005',timeOrigin:performance.timeOrigin,sampledAt:performance.now(),
  pipeline:pipeline?{...pipeline,queued:[...pipeline.queued],ready:[...pipeline.ready],failed:[...pipeline.failed],lods:Object.fromEntries(Object.entries(pipeline.lods).map(([k,v])=>[k,{...v}]))}:null,
  camera:camera?{...camera}:null,active:[...active.values()].map(v=>({...v})),recent:recent.map(v=>({...v})),
  limits:{pipelines:1,activeWorkRecords:4,completedWorkRecords:12},
  meaning:'steps count generator resumptions, not pixels; sampledAt versus lastAdvancedAt distinguishes observed advancement. A stalled JS thread cannot export a live report. Pipeline.active=false means paused; yielding includes browser scheduling delay.'};}
