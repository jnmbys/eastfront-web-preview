// INTERNAL TEST ONLY: explicit injections. Not imported by normal server entry.
import {Campaign as Existing,RULES} from '../grand-release-001/territory.mjs';
import {emptyDraft} from './templates.mjs';
import {PIECE_RULES,KINDS,totals,validatePieces,applyAdoption,refillStep,eligible} from './pieces.mjs';
const copy=structuredClone;
export class PieceFixture extends Existing{
 static newCampaignClass=PieceFixture;
 constructor(){super();const units={};
  for(const side of ['GERMAN','SOVIET']){const u=Object.values(this.state.units).find(u=>{if(u.side!==side||!u.alive)return false;try{eligible(this,u.id);return true;}catch{return false;}});if(!u)throw Error('FIXTURE_ROUTE_MISSING');
   units[u.id]={id:u.id,side,revision:0,personnel:1000,held:{infantry_equipment:100,support_equipment:0},target:{manpower:1000,equipment:{infantry_equipment:100}},org:this.clock.units[u.id].org,trainingExperience:0.4,templateId:null,templateVersion:null};
  }
  this.clock.pieces={schema:PIECE_RULES,fixture:true,tick:0,fixtureAdoptionFee:5,refill:{personnel:250,infantry_equipment:25,support_equipment:10},units,nations:Object.fromEntries(['GERMAN','SOVIET'].map(s=>[s,{xp:30,manpower:5000,stock:{infantry_equipment:500,support_equipment:100}}])),lastRefill:[]};
  this.clock.pieces.initial=totals(this.clock.pieces);this.syncPieceUnits();this.clock.paused=true;
 }
 syncPieceUnits(){for(const u of Object.values(this.clock.pieces.units))Object.assign(this.clock.units[u.id],{personnel:u.personnel,max:u.target.manpower,org:u.org,trainingExperience:u.trainingExperience});}
 advance(){throw Error('PIECE_INTERNAL_TEST_USE_REFILL_STEP');}
 transaction(req){
  const op=req.operation;
  if(op?.type==='DIVISION_DRAFT_SAVE'||op?.type==='DIVISION_PLAN_SET'||op?.type==='DIVISION_PLAN_CLEAR')return super.transaction(req);
  const prior=this.receipts.get(req.id),signature=JSON.stringify(req);if(prior){if(prior.signature!==signature)throw Error('ID_REUSE_CONFLICT');return copy(prior.result);}
  if(typeof req.id!=='string'||!/^[-\w:]{8,96}$/.test(req.id))throw Error('REQUEST_ID_REQUIRED');
  if(req.version!==this.version)throw Error('STALE_VERSION');if(this.clock.ended)throw Error('CAMPAIGN_FINISHED');
  if(!['GERMAN','SOVIET'].includes(this.viewer))throw Error('PIECE_SIDE_NOT_AUTHORIZED');
  const p=copy(this.clock.pieces);let result;
  if(op?.type==='DIVISION_ADOPT')result=applyAdoption(this,p,op);
  else if(op?.type==='DIVISION_REFILL_TEST_STEP'){result=refillStep(this,p);result.sent=result.sent.filter(x=>p.units[x.unit]?.side===this.viewer);}
  else throw Error('PIECE_INTERNAL_TEST_OPERATION_ONLY');
  validatePieces(p);this.clock.pieces=p;this.syncPieceUnits();this.version++;this.match.matchRevision=this.version;
  const r={ok:true,version:this.version,...result};this.receipts.set(req.id,{signature,result:r});return copy(r);
 }
 save(){const s=super.save();s.format=PIECE_RULES;return s;}
 restore(s,pause=true){if(s.format!==PIECE_RULES)throw Error('PIECE_TEST_SAVE_ONLY');validatePieces(s.clock?.pieces);for(const u of Object.values(s.clock.pieces.units)){if(s.state.units[u.id]?.side!==u.side)throw Error('PIECE_UNIT_LINK_INVALID');}
  const adapted=copy(s);adapted.format=RULES.version;delete adapted.clock.pieces;super.restore(adapted,pause);this.clock.pieces=copy(s.clock.pieces);this.syncPieceUnits();this.clock.paused=true;
 }
 snapshot(draft){const d=super.snapshot(draft),p=this.clock.pieces;if(!d.divisions)return d;
  d.divisions.pieceFixture={schema:p.schema,label:'内部件数换编测试 · 非正式战役',fee:p.fixtureAdoptionFee,tick:p.tick,refill:copy(p.refill),nation:copy(p.nations[this.viewer]),units:copy(Object.values(p.units).filter(u=>u.side===this.viewer)),lastRefill:copy(p.lastRefill.filter(x=>p.units[x.unit]?.side===this.viewer))};
  d.divisions.blockers=['此入口仅内部事务测试，经验/库存/补充速率/每次5经验均为显式夹具输入，不是原版公式','生产、真实经验来源、统一战斗属性尚未接入件数规则'];
  d.continuous.calendar='内部件数测试 · 补充步 '+p.tick;d.continuous.victoryText='内部件数测试；世界不推进战斗，使用编制面板补充测试步。';return d;
 }
}
export {emptyDraft,KINDS};
